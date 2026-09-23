import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTemplate } from "@/lib/whatsapp/client";
import { buildTemplateComponents, renderTemplate, type WaTemplate } from "@/lib/whatsapp/templates";
import { fillTokens, type Recipient } from "./recipients";

const CONCURRENCY = 5;

export interface BroadcastJob {
  broadcastId: string;
  template: WaTemplate;
  /** Slot values, which may contain {name}/{first_name}/{phone} tokens. */
  values: Record<string, string>;
  headerMediaUrl?: string;
  nameFallback: string;
}

async function ensureConversation(supabase: SupabaseClient, r: Recipient) {
  let { data: contact } = await supabase.from("contacts").select("*").eq("wa_id", r.phone).maybeSingle();
  if (!contact) {
    const { data, error } = await supabase
      .from("contacts")
      .upsert({ wa_id: r.phone, name: r.name }, { onConflict: "wa_id" })
      .select()
      .single();
    if (error) throw error;
    contact = data;
  }
  let { data: conversation } = await supabase.from("conversations").select("id").eq("contact_id", contact.id).maybeSingle();
  if (!conversation) {
    const { data, error } = await supabase
      .from("conversations")
      .upsert({ contact_id: contact.id }, { onConflict: "contact_id" })
      .select("id")
      .single();
    if (error) throw error;
    conversation = data;
  }
  return { contact, conversationId: conversation.id as string };
}

async function sendOne(supabase: SupabaseClient, job: BroadcastJob, row: { id: string; wa_id: string; name: string | null }) {
  const r: Recipient = { phone: row.wa_id, name: row.name };
  try {
    const { contact, conversationId } = await ensureConversation(supabase, r);
    if (contact.opted_out) {
      await supabase.from("broadcast_recipients").update({ status: "skipped", error: "Opted out (replied STOP)", conversation_id: conversationId }).eq("id", row.id);
      return;
    }

    // Prefer the name we already know from WhatsApp if the list didn't have one.
    const person: Recipient = { phone: r.phone, name: r.name || contact.name };
    const filled = Object.fromEntries(Object.entries(job.values).map(([k, v]) => [k, fillTokens(v, person, job.nameFallback)]));
    const components = buildTemplateComponents(job.template, filled, job.headerMediaUrl);
    const waMessageId = await sendTemplate(r.phone, { name: job.template.name, language: job.template.language, components });
    const body = renderTemplate(job.template, filled);

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "out",
      sender: "broadcast",
      body,
      type: "template",
      wa_message_id: waMessageId,
      status: "sent",
    });
    await supabase.rpc("touch_conversation", { p_conversation_id: conversationId, p_preview: body, p_inbound: false });
    await supabase
      .from("broadcast_recipients")
      .update({ status: "sent", wa_message_id: waMessageId, conversation_id: conversationId, sent_at: new Date().toISOString(), error: null })
      .eq("id", row.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("broadcast_recipients").update({ status: "failed", error: message }).eq("id", row.id);
  }
}

/** Send a broadcast to all of its queued recipients, a few at a time. */
export async function runBroadcast(supabase: SupabaseClient, job: BroadcastJob) {
  const { data: rows } = await supabase
    .from("broadcast_recipients")
    .select("id, wa_id, name")
    .eq("broadcast_id", job.broadcastId)
    .eq("status", "queued");

  const queue = [...(rows ?? [])];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      await sendOne(supabase, job, row);
    }
  });
  await Promise.all(workers);

  await supabase.from("broadcasts").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.broadcastId);
}
