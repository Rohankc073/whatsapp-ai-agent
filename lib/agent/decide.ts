import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeEntry, ReplyRule, Settings } from "@/lib/types";
import { matchRules } from "./rules";
import { buildSystemPrompt } from "./prompt";
import { generateReply, type ChatTurn } from "./ai";
import { humanizeReply } from "./humanize";

export interface AgentConfig {
  settings: Settings;
  rules: ReplyRule[];
  knowledge: KnowledgeEntry[];
}

export async function loadConfig(supabase: SupabaseClient): Promise<AgentConfig> {
  const [s, r, k] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("reply_rules").select("*").eq("active", true).order("priority"),
    supabase.from("knowledge_base").select("*").eq("active", true).order("created_at"),
  ]);
  if (s.error) throw s.error;
  if (r.error) throw r.error;
  if (k.error) throw k.error;
  return { settings: s.data, rules: r.data ?? [], knowledge: k.data ?? [] };
}

export type Decision =
  | { kind: "rule"; reply: string; rule: ReplyRule }
  | { kind: "ai"; reply: string; handoff: boolean; rule: ReplyRule | null; guides: ReplyRule[] };

/**
 * Decide what to reply to `text` (the customer's latest message(s)).
 * `history` is the conversation so far, ending with the customer's latest message(s).
 */
export async function decideReply(
  config: AgentConfig,
  text: string,
  history: ChatTurn[],
  context: { lead?: boolean } = {}
): Promise<Decision> {
  const match = matchRules(text, config.rules);
  if (match.fixed) {
    return { kind: "rule", reply: match.fixed.response, rule: match.fixed };
  }

  const system = buildSystemPrompt({
    settings: config.settings,
    knowledge: config.knowledge,
    guides: match.guides,
    intents: match.intents,
    lead: context.lead,
  });
  const ai = await generateReply({ system, history, model: config.settings.model });

  // An intent rule with a fixed reply: send the owner's exact text, not the model's paraphrase.
  const rule = ai.ruleId ? (config.rules.find((r) => r.id === ai.ruleId) ?? null) : null;
  if (rule && rule.response_mode === "fixed") {
    return { kind: "rule", reply: rule.response, rule };
  }

  // No answer from the AI in strict mode means "leave this one for the team".
  const handoff = ai.handoff || (config.settings.strict_scope && !ai.reply.trim());
  // An empty handoff message hands over silently (nothing is sent to the customer).
  const reply = handoff ? config.settings.handoff_message.trim() : humanizeReply(ai.reply) || config.settings.fallback_message;
  return { kind: "ai", reply, handoff, rule, guides: match.guides };
}
