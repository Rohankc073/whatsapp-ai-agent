import { createClient } from "@/lib/supabase/server";
import { KnowledgeManager } from "@/components/knowledge/KnowledgeManager";
import type { KnowledgeEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const supabase = await createClient();
  const { data } = await supabase.from("knowledge_base").select("*").order("created_at");
  return <KnowledgeManager initial={(data ?? []) as KnowledgeEntry[]} />;
}
