import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignature } from "@/lib/whatsapp/signature";
import { parseWebhook } from "@/lib/whatsapp/parse";
import type { WebhookPayload } from "@/lib/whatsapp/types";
import { handleInbound, handleStatus } from "@/lib/agent/handleInbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Leaves room for the burst debounce + OpenAI call that run after the 200 response.
export const maxDuration = 60;

// Meta webhook verification handshake
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET ?? "")) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const { inbound, statuses } = parseWebhook(payload, process.env.WHATSAPP_PHONE_NUMBER_ID);

  // Acknowledge immediately so Meta doesn't retry; process afterwards.
  after(async () => {
    const supabase = createAdminClient();
    await Promise.all([
      ...statuses.map((s) => handleStatus(supabase, s).catch((e) => console.error("status failed", e))),
      ...inbound.map((m) => handleInbound(supabase, m).catch((e) => console.error("inbound failed", e))),
    ]);
  });

  return NextResponse.json({ ok: true });
}
