import type { SupabaseClient } from "@supabase/supabase-js";

export const DEBOUNCE_MS = Number(process.env.REPLY_DEBOUNCE_MS ?? 4000);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait briefly, then report whether `messageId` is still the newest inbound message.
 * If the customer sent more messages meanwhile, the newest one's handler replies to all of them.
 */
export async function isStillLatest(supabase: SupabaseClient, conversationId: string, messageId: string) {
  await sleep(DEBOUNCE_MS);
  const { data } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data?.id === messageId;
}
