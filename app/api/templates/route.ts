import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { listTemplates } from "@/lib/whatsapp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ templates: await listTemplates() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load templates" }, { status: 502 });
  }
}
