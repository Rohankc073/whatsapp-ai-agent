import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message } from "@/lib/types";
import type { ParsedInbound, ParsedStatus, WaMessage } from "@/lib/whatsapp/types";
import { markRead, showTyping } from "@/lib/whatsapp/client";
import { isStillLatest, sleep } from "./debounce";
import { typingDelayMs } from "./humanize";
import { decideReply, loadConfig } from "./decide";
import { sendAndStore } from "./outbound";
import { OPT_IN_REPLY, OPT_OUT_REPLY, optOutIntent } from "./optout";
import type { ChatTurn } from "./ai";

const HISTORY_LIMIT = 20;

// Don't downgrade (e.g. a late "delivered" arriving after "read").
const STATUS_ORDER = ["queued", "pending", "sent", "delivered", "read"];
const isUpgrade = (from: string, to: string) => to === "failed" || STATUS_ORDER.indexOf(from) < STATUS_ORDER.indexOf(to);

export async function handleStatus(supabase: SupabaseClient, s: ParsedStatus) {
  const { data: message } = await supabase.from("messages").select("status").eq("wa_message_id", s.waMessageId).maybeSingle();
  if (message && isUpgrade(message.status, s.status)) {
    await supabase.from("messages").update({ status: s.status, error: s.error }).eq("wa_message_id", s.waMessageId);
  }

  const { data: recipient } = await supabase
    .from("broadcast_recipients")
    .select("status")
    .eq("wa_message_id", s.waMessageId)
    .maybeSingle();
  if (recipient && isUpgrade(recipient.status, s.status)) {
    await supabase.from("broadcast_recipients").update({ status: s.status, error: s.error }).eq("wa_message_id", s.waMessageId);
  }
}

export async function handleInbound(supabase: SupabaseClient, msg: ParsedInbound) {
  // 1. Contact + conversation
  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .upsert({ wa_id: msg.from, ...(msg.contactName ? { name: msg.contactName } : {}) }, { onConflict: "wa_id" })
    .select()
    .single();
  if (cErr) throw cErr;

  let { data: conversation } = await supabase.from("conversations").select("*").eq("contact_id", contact.id).maybeSingle();
  if (!conversation) {
    const { data, error } = await supabase
      .from("conversations")
      .upsert({ contact_id: contact.id }, { onConflict: "contact_id" })
      .select()
      .single();
    if (error) throw error;
    conversation = data;
  }

  // 2. Store the message; a duplicate wa_message_id means Meta re-delivered it.
  const preview = msg.text ?? `[${msg.type}]`;
  const { data: stored, error: mErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      direction: "in",
      sender: "contact",
      body: msg.text,
      type: msg.type,
      wa_message_id: msg.waMessageId,
      status: "received",
      raw: msg.raw,
    })
    .select()
    .single();
  if (mErr) {
    if (mErr.code === "23505") return; // duplicate delivery
    throw mErr;
  }

  // Blue ticks are sent only when a reply is coming, so a chat nobody is handling doesn't show as "read".
  // Independent writes run in parallel — each database round trip adds latency to the reply.
  const configPromise = loadConfig(supabase);
  configPromise.catch(() => {}); // awaited below; avoid an unhandled rejection if we return early
  const adReferral = msg.raw.referral;
  await Promise.all([
    supabase.rpc("touch_conversation", { p_conversation_id: conversation.id, p_preview: preview, p_inbound: true }),
    // Chat opened from a Facebook/Instagram click-to-WhatsApp ad: remember it's a lead.
    adReferral
      ? supabase
          .from("conversations")
          .update({ source: "meta_ad", ad_headline: adReferral.headline ?? null })
          .eq("id", conversation.id)
      : Promise.resolve(),
    // Mark recent broadcasts to this number as replied.
    supabase
      .from("broadcast_recipients")
      .update({ replied_at: new Date().toISOString() })
      .eq("wa_id", contact.wa_id)
      .is("replied_at", null)
      .gte("sent_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  // STOP / START handling (always, even if AI is off).
  const optOut = optOutIntent(msg.text);
  if (optOut === "stop" || (optOut === "start" && contact.opted_out)) {
    const stop = optOut === "stop";
    await markRead(msg.waMessageId);
    await supabase
      .from("contacts")
      .update({ opted_out: stop, opted_out_at: stop ? new Date().toISOString() : null })
      .eq("id", contact.id);
    await sendAndStore(supabase, {
      conversationId: conversation.id,
      to: contact.wa_id,
      text: stop ? OPT_OUT_REPLY : OPT_IN_REPLY,
      sender: "system",
    });
    return;
  }

  // 3. Should the AI reply at all?
  const config = await configPromise;
  if (!config.settings.global_ai_enabled || !conversation.ai_enabled) return;

  // 4. Let a burst of messages settle, then only the newest handler replies.
  if (!(await isStillLatest(supabase, conversation.id, stored.id))) return;

  // Owner may have taken over during the wait; load the chat history at the same time.
  const [{ data: fresh }, { data: recent }] = await Promise.all([
    supabase.from("conversations").select("ai_enabled").eq("id", conversation.id).single(),
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);
  if (!fresh?.ai_enabled) return;

  // 5. The pending (unanswered) customer messages.
  const messages = ((recent ?? []) as Message[]).reverse();
  const lastOutIdx = messages.findLastIndex((m) => m.direction === "out");
  const pending = messages.slice(lastOutIdx + 1).filter((m) => m.direction === "in");
  // Another handler already answered these (a reply went out while we waited).
  if (!pending.length) return;
  const pendingText = pending
    .map((m) => m.body)
    .filter(Boolean)
    .join("\n");

  // Read receipt + "typing…" like a person picking up their phone — runs alongside writing the reply.
  const typingStartedAt = Date.now();
  const typing = showTyping(msg.waMessageId);

  // First message from a Meta ad (the ad preview + whatever they typed): send the lead reply.
  if (pending.some((m) => (m.raw as WaMessage | null)?.referral)) {
    await typing;
    await sleep(Math.max(0, typingDelayMs(config.settings.lead_message) - (Date.now() - typingStartedAt)));
    await sendAndStore(supabase, { conversationId: conversation.id, to: contact.wa_id, text: config.settings.lead_message, sender: "rule" });
    return;
  }

  if (!pendingText) {
    // Only media/unsupported messages — ask them to type instead.
    await typing;
    await sleep(Math.max(0, typingDelayMs(config.settings.unsupported_message) - (Date.now() - typingStartedAt)));
    await sendAndStore(supabase, {
      conversationId: conversation.id,
      to: contact.wa_id,
      text: config.settings.unsupported_message,
      sender: "system",
    });
    return;
  }

  const history: ChatTurn[] = messages
    .filter((m) => m.body)
    .map((m) => ({ role: m.direction === "in" ? "user" : "assistant", content: m.body! }));

  // 6. Decide and send.
  let reply: string;
  let sender: "ai" | "rule" | "system" = "ai";
  let handoff = false;
  try {
    const decision = await decideReply(config, pendingText, history, {
      lead: conversation.source === "meta_ad" || !!adReferral,
    });
    reply = decision.reply;
    sender = decision.kind === "rule" ? "rule" : "ai";
    handoff = decision.kind === "ai" && decision.handoff;
  } catch (err) {
    console.error("Reply generation failed", err);
    reply = config.settings.fallback_message;
    sender = "system";
  }

  // Wait out a realistic typing time (time spent generating the reply counts towards it).
  await typing;
  // A silent handover (empty handoff message) sends nothing; the team replies instead.
  if (reply.trim()) {
    await sleep(Math.max(0, typingDelayMs(reply) - (Date.now() - typingStartedAt)));
    await sendAndStore(supabase, { conversationId: conversation.id, to: contact.wa_id, text: reply, sender });
  }

  if (handoff) {
    await supabase.from("conversations").update({ ai_enabled: false, needs_human: true }).eq("id", conversation.id);
  }
}
