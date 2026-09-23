import { createClient } from "@/lib/supabase/server";
import { ConversationsView } from "@/components/conversations/ConversationsView";
import type { Conversation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("*, contact:contacts(*)")
    .order("last_message_at", { ascending: false })
    .limit(200);

  return <ConversationsView initial={(data ?? []) as Conversation[]} initialSelected={c ?? null} />;
}
