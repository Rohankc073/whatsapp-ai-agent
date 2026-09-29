import "server-only";
import OpenAI from "openai";

// Gemini is used when GEMINI_API_KEY is set (via Google's OpenAI-compatible endpoint), unless AI_PROVIDER=openai.
export const AI_PROVIDER: "gemini" | "openai" =
  process.env.AI_PROVIDER === "openai" || (!process.env.GEMINI_API_KEY && process.env.AI_PROVIDER !== "gemini") ? "openai" : "gemini";

export const DEFAULT_MODEL =
  AI_PROVIDER === "gemini" ? process.env.GEMINI_MODEL || "gemini-3.1-flash-lite" : process.env.OPENAI_MODEL || "gpt-5.4-mini";

// A customer is waiting: don't sit on a slow or failing request (the SDK would otherwise retry twice
// with backoff and wait up to 10 minutes). generateReply switches to the backup model instead.
const FAST_FAIL = { timeout: 8_000, maxRetries: 0 };

let client: OpenAI | null = null;
function ai() {
  if (!client) {
    client =
      AI_PROVIDER === "gemini"
        ? new OpenAI({
            apiKey: process.env.GEMINI_API_KEY,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
            ...FAST_FAIL,
          })
        : new OpenAI({ apiKey: process.env.OPENAI_API_KEY, ...FAST_FAIL });
  }
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

/** Some models wrap JSON in ```json fences. */
function stripCodeFence(content: string | null | undefined) {
  return content?.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, "$1");
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
  const messages = [{ role: "system" as const, content: opts.system }, ...opts.history];
  const primary = opts.model || DEFAULT_MODEL;
  // Busy or out of quota (common on Gemini's free tier): try the backup model rather than waiting.
  const attempts = AI_PROVIDER === "gemini" && primary !== GEMINI_BACKUP_MODEL ? [primary, GEMINI_BACKUP_MODEL] : [primary, primary];

  let lastError: unknown;
  for (const [i, model] of attempts.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 500));
    try {
      const completion = await createCompletion(model, messages);
      return parseAiOutput(stripCodeFence(completion.choices[0]?.message?.content));
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof OpenAI.APIConnectionError || // includes timeouts
        (err instanceof OpenAI.APIError && (err.status === 429 || (err.status ?? 0) >= 500));
      if (!retryable) throw err;
    }
  }
  throw lastError;
}

const GEMINI_BACKUP_MODEL = "gemini-flash-lite-latest";

async function createCompletion(model: string, messages: OpenAI.Chat.ChatCompletionMessageParam[]) {
  try {
    return await ai().chat.completions.create({ model, messages, response_format: { type: "json_object" } });
  } catch (err) {
    // Some compatible endpoints reject JSON mode; the prompt still asks for JSON and parseAiOutput copes with plain text.
    if (!(err instanceof OpenAI.APIError && err.status === 400 && /response_format|json/i.test(err.message))) throw err;
    return ai().chat.completions.create({ model, messages });
  }
}
