export type MatchType = "exact" | "contains" | "starts_with" | "intent";
export type ResponseMode = "fixed" | "guide";
export type Sender = "contact" | "ai" | "rule" | "human" | "system" | "broadcast";
export type MessageStatus = "received" | "pending" | "sent" | "delivered" | "read" | "failed";

export interface Contact {
  id: string;
  wa_id: string;
  name: string | null;
  opted_out: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  contact_id: string;
  ai_enabled: boolean;
  needs_human: boolean;
  unread_count: number;
  last_message_at: string;
  last_message_preview: string | null;
  last_inbound_at: string | null;
  created_at: string;
  contact?: Contact;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  sender: Sender;
  body: string | null;
  type: string;
  wa_message_id: string | null;
  status: MessageStatus;
  error: string | null;
  created_at: string;
}

export interface ReplyRule {
  id: string;
  name: string;
  match_type: MatchType;
  trigger: string;
  response_mode: ResponseMode;
  response: string;
  priority: number;
  active: boolean;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  active: boolean;
}

export interface Settings {
  id: number;
  agent_name: string;
  business_name: string;
  persona: string;
  global_ai_enabled: boolean;
  model: string | null;
  fallback_message: string;
  handoff_message: string;
  unsupported_message: string;
}

export type RecipientStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "skipped";

export interface Broadcast {
  id: string;
  name: string;
  template_name: string;
  template_language: string;
  preview: string | null;
  status: "sending" | "completed";
  created_at: string;
  completed_at: string | null;
}

export interface BroadcastRecipient {
  id: string;
  broadcast_id: string;
  wa_id: string;
  name: string | null;
  status: RecipientStatus;
  error: string | null;
  wa_message_id: string | null;
  conversation_id: string | null;
  sent_at: string | null;
  replied_at: string | null;
}
