import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAndStore } from "@/lib/agent/outbound";

export const runtime = "nodejs";

// Manual reply from the dashboard
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId, text } = (await req.json().catch(() => ({}))) as { conversationId?: string; text?: string };
  const body = text?.trim();
  if (!conversationId || !body) return NextResponse.json({ error: "conversationId and text are required" }, { status: 400 });

  const { data: conv, error } = await supabase
    .from("conversations")
    .select("id, contact:contacts(wa_id)")
    .eq("id", conversationId)
    .single();
  if (error || !conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const waId = (conv.contact as unknown as { wa_id: string }).wa_id;
  const result = await sendAndStore(supabase, { conversationId, to: waId, text: body, sender: "human" });

  if (result.error) {
    const outside24h = /131047|re-engagement|24 hours/i.test(result.error);
    return NextResponse.json(
      {
        error: outside24h
          ? "This chat is outside WhatsApp's 24-hour reply window. The customer must message you first."
          : result.error,
      },
      { status: 502 }
    );
  }

  // A human replied — clear the "needs human" flag.
  await supabase.from("conversations").update({ needs_human: false }).eq("id", conversationId);
  return NextResponse.json({ message: result.message });
}
