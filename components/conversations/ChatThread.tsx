"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { AlertTriangle, ArrowLeft, Bot, Check, CheckCheck, Clock, Megaphone, Workflow, User, XCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Conversation, Message } from "@/lib/types";
import { cn, formatPhone, initials } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Composer } from "./Composer";

const SENDER_LABEL: Record<string, { label: string; icon: typeof Bot } | undefined> = {
  ai: { label: "AI", icon: Bot },
  rule: { label: "Rule", icon: Workflow },
  human: { label: "You", icon: User },
  system: { label: "Auto", icon: Bot },
  broadcast: { label: "Broadcast", icon: Megaphone },
};

function dayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, d MMMM yyyy");
}

function StatusIcon({ status }: { status: Message["status"] }) {
  switch (status) {
    case "pending":
      return <Clock className="size-3.5" />;
    case "sent":
      return <Check className="size-3.5" />;
    case "delivered":
      return <CheckCheck className="size-3.5" />;
    case "read":
      return <CheckCheck className="size-3.5 text-info" />;
    case "failed":
      return <XCircle className="size-3.5 text-danger" />;
    default:
      return null;
  }
}

export function ChatThread({
  conversation,
  onBack,
  onPatch,
}: {
  conversation: Conversation;
  onBack: () => void;
  onPatch: (id: string, patch: Partial<Conversation>) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const contact = conversation.contact;
  const name = contact?.name || formatPhone(contact?.wa_id ?? "");

  // Load + subscribe to this conversation's messages
  useEffect(() => {
    let active = true;
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(500)
      .then(({ data }) => {
        if (!active) return;
        setMessages((data ?? []) as Message[]);
        setLoading(false);
      });

    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new as Message;
          if (payload.eventType === "INSERT") {
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, conversation.id]);

  // Mark as read when opened and whenever new messages arrive while open
  useEffect(() => {
    if (conversation.unread_count > 0) {
      onPatch(conversation.id, { unread_count: 0 });
      supabase.from("conversations").update({ unread_count: 0 }).eq("id", conversation.id).then();
    }
  }, [conversation.unread_count, conversation.id, onPatch, supabase]);

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, loading]);

  async function update(patch: Partial<Conversation>) {
    onPatch(conversation.id, patch);
    const { error } = await supabase.from("conversations").update(patch).eq("id", conversation.id);
    if (error) toast.error(error.message);
  }

  function onSent(m: Message) {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    onPatch(conversation.id, { needs_human: false });
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <button onClick={onBack} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 md:hidden" aria-label="Back">
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
          {initials(contact?.name, contact?.wa_id ?? "")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted">{formatPhone(contact?.wa_id ?? "")}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5">
          <Bot className={cn("size-4", conversation.ai_enabled ? "text-primary" : "text-muted")} />
          <span className="hidden text-xs font-medium sm:inline">{conversation.ai_enabled ? "AI on" : "AI off"}</span>
          <Switch
            checked={conversation.ai_enabled}
            onCheckedChange={(v) => update(v ? { ai_enabled: true, needs_human: false } : { ai_enabled: false })}
            aria-label="AI replies for this chat"
          />
        </label>
      </div>

      {conversation.needs_human && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-warning-soft px-4 py-2 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">The AI handed this chat to you and paused itself. Reply below, or turn AI back on.</span>
          <Button size="sm" variant="secondary" onClick={() => update({ needs_human: false })}>
            Mark resolved
          </Button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-chat-bg px-3 py-4 sm:px-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted">Loading…</p>
        ) : (
          <div className="mx-auto max-w-3xl space-y-1.5">
            {messages.map((m, i) => {
              const d = new Date(m.created_at);
              const prev = messages[i - 1];
              const newDay = !prev || new Date(prev.created_at).toDateString() !== d.toDateString();
              const out = m.direction === "out";
              const tag = out ? SENDER_LABEL[m.sender] : undefined;
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-md bg-surface px-2.5 py-1 text-[11px] font-medium text-muted shadow-sm">
                        {dayLabel(d)}
                      </span>
                    </div>
                  )}
                  <div className={cn("flex", out ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                        out ? "rounded-tr-sm bg-bubble-out" : "rounded-tl-sm bg-bubble-in",
                        m.status === "failed" && "ring-1 ring-danger"
                      )}
                    >
                      {m.body ? (
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      ) : (
                        <p className="italic text-muted">[{m.type} message]</p>
                      )}
                      <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-muted">
                        {tag && (
                          <span className="mr-auto inline-flex items-center gap-1 font-medium">
                            <tag.icon className="size-3" />
                            {tag.label}
                          </span>
                        )}
                        <span>{format(d, "HH:mm")}</span>
                        {out && <StatusIcon status={m.status} />}
                      </div>
                      {m.status === "failed" && m.error && <p className="mt-1 text-[11px] text-danger">{m.error}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
            {!messages.length && <p className="py-10 text-center text-sm text-muted">No messages yet.</p>}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <Composer conversationId={conversation.id} aiEnabled={conversation.ai_enabled} onSent={onSent} />
    </div>
  );
}
