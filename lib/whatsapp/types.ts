// Subset of the WhatsApp Cloud API webhook payload we use.
export interface WebhookPayload {
  object?: string;
  entry?: {
    id: string;
    changes?: { field: string; value: ChangeValue }[];
  }[];
}

export interface ChangeValue {
  messaging_product?: string;
  metadata?: { display_phone_number: string; phone_number_id: string };
  contacts?: { profile?: { name?: string }; wa_id: string }[];
  messages?: WaMessage[];
  statuses?: WaStatus[];
}

export interface WaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text: string; payload?: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
    nfm_reply?: { response_json?: string; body?: string; name?: string };
  };
  /** Present when the chat was opened from a click-to-WhatsApp ad (Facebook/Instagram). */
  referral?: { headline?: string; body?: string; source_url?: string; source_type?: string; source_id?: string; ctwa_clid?: string };
}

export interface WaStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: { code: number; title: string; message?: string; error_data?: { details?: string } }[];
}

export interface ParsedInbound {
  waMessageId: string;
  from: string;
  contactName: string | null;
  type: string;
  /** Text we can reply to; null for media and other unsupported types. */
  text: string | null;
  raw: WaMessage;
}

export interface ParsedStatus {
  waMessageId: string;
  status: WaStatus["status"];
  error: string | null;
}
