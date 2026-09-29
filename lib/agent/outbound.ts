import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sender } from "@/lib/types";
import { sendText } from "@/lib/whatsapp/client";

/** Send a WhatsApp text and record it. Returns the stored message (status "failed" if sending failed). */
export async function sendAndStore(
  supabase: SupabaseClient,
  opts: { conversationId: string; to: string; text: string; sender: Sender }
) {
  let waMessageId: string | null = null;
  let error: string | null = null;
  try {
    waMessageId = await sendText(opts.to, opts.text);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error("WhatsApp send failed", error);
  }

  const [{ data, error: dbError }] = await Promise.all([
    supabase
      .from("messages")
      .insert({
        conversation_id: opts.conversationId,
        direction: "out",
        sender: opts.sender,
        body: opts.text,
        type: "text",
        wa_message_id: waMessageId,
        status: error ? "failed" : "sent",
        error,
      })
      .select()
      .single(),
    supabase.rpc("touch_conversation", {
      p_conversation_id: opts.conversationId,
      p_preview: opts.text,
      p_inbound: false,
    }),
  ]);
  if (dbError) console.error("Failed to store outbound message", dbError);

  return { message: data, error };
}
