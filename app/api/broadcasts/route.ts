import { after, NextResponse, type NextRequest } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTemplates } from "@/lib/whatsapp/client";
import { headerMediaFormat, renderTemplate, templateSlots } from "@/lib/whatsapp/templates";
import { fillTokens, normalizePhone, type Recipient } from "@/lib/broadcast/recipients";
import { runBroadcast } from "@/lib/broadcast/send";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_RECIPIENTS = 1000;

interface Body {
  name?: string;
  template?: { name: string; language: string };
  values?: Record<string, string>;
  headerMediaUrl?: string;
  nameFallback?: string;
  recipients?: Recipient[];
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

  // Re-validate recipients server-side
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  for (const r of body.recipients ?? []) {
    const phone = normalizePhone(String(r.phone ?? ""));
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    recipients.push({ phone, name: r.name?.toString().trim() || null });
  }
  if (!recipients.length) return bad("Add at least one valid phone number.");
  if (recipients.length > MAX_RECIPIENTS) return bad(`A broadcast can have at most ${MAX_RECIPIENTS} recipients.`);
  if (!body.template?.name) return bad("Choose a template.");

  // Use the template as Meta has it, not as the browser sent it.
  let templates;
  try {
    templates = await listTemplates();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load templates" }, { status: 502 });
  }
  const template = templates.find((t) => t.name === body.template!.name && t.language === body.template!.language);
  if (!template) return bad("That template is not approved (or no longer exists).");

  const values = body.values ?? {};
  const missing = templateSlots(template).filter((s) => !values[s.key]?.trim());
  if (missing.length) return bad(`Fill in: ${missing.map((s) => s.label).join(", ")}`);
  if (headerMediaFormat(template) && !/^https:\/\//.test(body.headerMediaUrl ?? "")) {
    return bad("This template needs a public https:// link for its header media.");
  }
  const nameFallback = body.nameFallback?.trim() || "there";

  const { data: broadcast, error } = await supabase
    .from("broadcasts")
    .insert({
      name: body.name?.trim() || `${template.name} · ${new Date().toLocaleDateString("en-IN")}`,
      template_name: template.name,
      template_language: template.language,
      preview: renderTemplate(
        template,
        Object.fromEntries(Object.entries(values).map(([k, v]) => [k, fillTokens(v, recipients[0], nameFallback)]))
      ),
      created_by: user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: rErr } = await supabase
    .from("broadcast_recipients")
    .insert(recipients.map((r) => ({ broadcast_id: broadcast.id, wa_id: r.phone, name: r.name })));
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  after(() =>
    runBroadcast(createAdminClient(), {
      broadcastId: broadcast.id,
      template,
      values,
      headerMediaUrl: body.headerMediaUrl,
      nameFallback,
    }).catch((e) => console.error("broadcast failed", e))
  );

  return NextResponse.json({ id: broadcast.id });
}
