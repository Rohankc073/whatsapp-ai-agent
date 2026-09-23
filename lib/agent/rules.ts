import type { ReplyRule } from "@/lib/types";

/** Lowercase, strip punctuation/emoji, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A trigger can hold several alternatives separated by "|" or new lines. */
export function splitTriggers(trigger: string): string[] {
  return trigger
    .split(/[|\n]/)
    .map(normalize)
    .filter(Boolean);
}

export function ruleMatches(rule: ReplyRule, text: string): boolean {
  if (rule.match_type === "intent") return false;
  const msg = normalize(text);
  if (!msg) return false;

  return splitTriggers(rule.trigger).some((t) => {
    switch (rule.match_type) {
      case "exact":
        return msg === t;
      case "starts_with":
        return msg === t || msg.startsWith(t + " ");
      case "contains":
        // Whole-word/phrase match so "hi" doesn't match "this".
        return ` ${msg} `.includes(` ${t} `);
      default:
        return false;
    }
  });
}

export interface RuleMatch {
  /** Highest-priority keyword rule, if it is a fixed reply — send it as-is. */
  fixed: ReplyRule | null;
  /** Keyword rules that matched and should steer the AI. */
  guides: ReplyRule[];
  /** Intent rules — the AI decides whether they apply. */
  intents: ReplyRule[];
}

/** Lower `priority` number wins. */
export function matchRules(text: string, rules: ReplyRule[]): RuleMatch {
  const active = rules.filter((r) => r.active).sort((a, b) => a.priority - b.priority);
  const matched = active.filter((r) => ruleMatches(r, text));
  const intents = active.filter((r) => r.match_type === "intent");

  const top = matched[0];
  if (top && top.response_mode === "fixed") {
    return { fixed: top, guides: [], intents: [] };
  }
  return { fixed: null, guides: matched, intents };
}
