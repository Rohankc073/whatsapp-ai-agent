import "server-only";
import OpenAI from "openai";

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

let client: OpenAI | null = null;
function openai() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiResult {
  reply: string;
  handoff: boolean;
  ruleId: string | null;
}

export function parseAiOutput(content: string | null | undefined): AiResult {
  if (!content) throw new Error("Empty AI response");
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    // Model ignored JSON mode — use the raw text as the reply.
    return { reply: content.trim(), handoff: false, ruleId: null };
  }
  const obj = data as Record<string, unknown>;
  const reply = typeof obj.reply === "string" ? obj.reply.trim() : "";
  return {
    reply,
    handoff: obj.handoff === true,
    ruleId: typeof obj.rule_id === "string" && obj.rule_id ? obj.rule_id : null,
  };
}

export async function generateReply(opts: { system: string; history: ChatTurn[]; model?: string | null }): Promise<AiResult> {
  const completion = await openai().chat.completions.create({
    model: opts.model || DEFAULT_MODEL,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: opts.system }, ...opts.history],
  });
  return parseAiOutput(completion.choices[0]?.message?.content);
}
