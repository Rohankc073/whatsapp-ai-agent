import { createClient } from "@/lib/supabase/server";
import { RulesManager } from "@/components/rules/RulesManager";
import type { ReplyRule } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("reply_rules").select("*").order("priority").order("created_at");
  return <RulesManager initial={(data ?? []) as ReplyRule[]} />;
}
