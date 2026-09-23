import type { KnowledgeEntry, ReplyRule, Settings } from "@/lib/types";

export function buildSystemPrompt(opts: {
  settings: Settings;
  knowledge: KnowledgeEntry[];
  guides: ReplyRule[];
  intents: ReplyRule[];
}): string {
  const { settings, knowledge, guides, intents } = opts;
  const parts: string[] = [];

  parts.push(
    `You are ${settings.agent_name}, replying on WhatsApp on behalf of ${settings.business_name}.`,
    settings.persona.trim()
  );

  if (knowledge.length) {
    parts.push(
      "## Business knowledge (the only facts you may state about the business)\n" +
        knowledge.map((k) => `### ${k.title}\n${k.content.trim()}`).join("\n\n")
    );
  }

  if (guides.length) {
    parts.push(
      "## Owner instructions for this message (follow these)\n" + guides.map((g) => `- ${g.response.trim()}`).join("\n")
    );
  }

  if (intents.length) {
    parts.push(
      "## Conditional rules (apply the first one whose situation matches the customer's latest message)\n" +
        intents
          .map((r) =>
            r.response_mode === "fixed"
              ? `- [rule_id: ${r.id}] If the customer is ${r.trigger.trim()}: reply with exactly the owner's approved text, and set "rule_id" to "${r.id}".`
              : `- [rule_id: ${r.id}] If the customer is ${r.trigger.trim()}: ${r.response.trim()}`
          )
          .join("\n")
    );
  }

  parts.push(`## Rules you must always follow
- Keep replies short and conversational, like a real WhatsApp message (1–4 short sentences). No markdown headings or tables.
- Reply in the same language the customer writes in.
- Only state facts found in the business knowledge above. If you don't know something, say our team will follow up — never make things up.
- Never promise funding, investment amounts, valuations, equity percentages, timelines or approval. Those are decided only by our team after review.
- Don't ask for more than two things in one message.
- Set "handoff" to true if the customer asks for a human/call, is upset, or needs something you cannot help with.

## Output format
Respond with a JSON object only: {"reply": string, "handoff": boolean, "rule_id": string | null}`);

  return parts.filter(Boolean).join("\n\n");
}
