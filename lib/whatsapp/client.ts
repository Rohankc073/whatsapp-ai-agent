import "server-only";
import type { WaTemplate } from "./templates";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

function endpoint() {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not set");
  return `https://graph.facebook.com/${GRAPH_VERSION}/${id}/messages`;
}

async function post(body: Record<string, unknown>) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN is not set");

  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json?.error;
    const detail = e?.error_data?.details || e?.message || res.statusText;
    throw new WhatsAppError(`WhatsApp API ${res.status}: ${detail}`, e?.code);
  }
  return json;
}

export class WhatsAppError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
}

/** Send a text message. Returns the WhatsApp message id. */
export async function sendText(to: string, text: string): Promise<string> {
  const json = await post({
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body: text },
  });
  return json.messages?.[0]?.id;
}

/** Mark an inbound message as read (blue ticks). Failures are non-fatal. */
export async function markRead(waMessageId: string) {
  try {
    await post({ status: "read", message_id: waMessageId });
  } catch (err) {
    console.warn("markRead failed", err);
  }
}

/** Send an approved template message. Returns the WhatsApp message id. */
export async function sendTemplate(
  to: string,
  template: { name: string; language: string; components: Record<string, unknown>[] }
): Promise<string> {
  const json = await post({
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      ...(template.components.length ? { components: template.components } : {}),
    },
  });
  return json.messages?.[0]?.id;
}

/** Approved templates on the WhatsApp Business Account. */
export async function listTemplates(): Promise<WaTemplate[]> {
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!waba) throw new Error("WHATSAPP_BUSINESS_ACCOUNT_ID is not set");
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN is not set");

  const templates: WaTemplate[] = [];
  let url: string | null =
    `https://graph.facebook.com/${GRAPH_VERSION}/${waba}/message_templates` +
    `?fields=id,name,language,status,category,parameter_format,components&status=APPROVED&limit=100`;
  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new WhatsAppError(`WhatsApp API ${res.status}: ${json?.error?.message || res.statusText}`, json?.error?.code);
    templates.push(...json.data);
    url = json.paging?.next ?? null;
  }
  return templates.filter((t) => t.status === "APPROVED");
}
