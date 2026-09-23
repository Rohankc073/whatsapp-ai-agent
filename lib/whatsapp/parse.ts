import type { ParsedInbound, ParsedStatus, WaMessage, WebhookPayload } from "./types";

/** Pull the readable text out of a WhatsApp message, or null if it isn't text-like. */
export function extractText(msg: WaMessage): string | null {
  switch (msg.type) {
    case "text":
      return msg.text?.body?.trim() || null;
    case "button":
      return msg.button?.text?.trim() || null;
    case "interactive": {
      const i = msg.interactive;
      const t = i?.button_reply?.title ?? i?.list_reply?.title ?? i?.nfm_reply?.body ?? i?.nfm_reply?.response_json;
      return t?.trim() || null;
    }
    default:
      return null;
  }
}

/**
 * Flatten a webhook payload into inbound messages and status updates.
 * If `phoneNumberId` is given, events for other numbers on the same WABA are ignored.
 */
export function parseWebhook(payload: WebhookPayload, phoneNumberId?: string) {
  const inbound: ParsedInbound[] = [];
  const statuses: ParsedStatus[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      if (phoneNumberId && value.metadata?.phone_number_id && value.metadata.phone_number_id !== phoneNumberId) {
        continue;
      }

      const names = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));

      for (const msg of value.messages ?? []) {
        inbound.push({
          waMessageId: msg.id,
          from: msg.from,
          contactName: names.get(msg.from) ?? null,
          type: msg.type,
          text: extractText(msg),
          raw: msg,
        });
      }

      for (const s of value.statuses ?? []) {
        const err = s.errors?.[0];
        statuses.push({
          waMessageId: s.id,
          status: s.status,
          error: err ? `${err.code}: ${err.error_data?.details || err.message || err.title}` : null,
        });
      }
    }
  }

  return { inbound, statuses };
}
