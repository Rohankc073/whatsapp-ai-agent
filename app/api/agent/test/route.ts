import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { decideReply, loadConfig } from "@/lib/agent/decide";
import type { ChatTurn } from "@/lib/agent/ai";

export const runtime = "nodejs";

// "Test the agent" playground — decides a reply without sending anything to WhatsApp.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, history = [] } = (await req.json().catch(() => ({}))) as { message?: string; history?: ChatTurn[] };
  if (!message?.trim()) return NextResponse.json({ error: "message is required" }, { status: 400 });

  try {
    const config = await loadConfig(supabase);
    const decision = await decideReply(config, message, [...history, { role: "user", content: message }]);
    return NextResponse.json({
      reply: decision.reply,
      source: decision.kind,
      rule: decision.rule ? { id: decision.rule.id, name: decision.rule.name } : null,
      handoff: decision.kind === "ai" ? decision.handoff : false,
      guides: decision.kind === "ai" ? decision.guides.map((g) => g.name) : [],
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Agent failed" }, { status: 500 });
  }
}
