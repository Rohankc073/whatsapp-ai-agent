"use client";

import { useMemo, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { BotOff, Search } from "lucide-react";
import type { Conversation } from "@/lib/types";
import { cn, formatPhone, initials } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type Filter = "all" | "unread" | "human";

function when(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM");
}

export function ChatList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const humanCount = conversations.filter((c) => c.needs_human).length;
  const unreadCount = conversations.filter((c) => c.unread_count > 0).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread_count === 0) return false;
      if (filter === "human" && !c.needs_human) return false;
      if (!q) return true;
      return (
        c.contact?.name?.toLowerCase().includes(q) ||
        c.contact?.wa_id.includes(q.replace(/\D/g, "") || "\u0000") ||
        c.last_message_preview?.toLowerCase().includes(q)
      );
    });
  }, [conversations, query, filter]);

  const tabs: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "human", label: "Needs human", count: humanCount },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <div className="space-y-3 border-b border-border p-4">
        <h1 className="text-base font-semibold">Conversations</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input placeholder="Search name, number or message" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === t.id ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2"
              )}
            >
              {t.label}
              {!!t.count && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px]",
                    t.id === "human" ? "bg-warning text-white" : "bg-primary text-primary-foreground"
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {visible.map((c) => {
          const name = c.contact?.name || formatPhone(c.contact?.wa_id ?? "");
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors",
                  selectedId === c.id ? "bg-primary-soft" : "hover:bg-surface-2"
                )}
              >
                <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted">
                  {initials(c.contact?.name, c.contact?.wa_id ?? "")}
                  {c.needs_human && (
                    <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-surface bg-warning" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("truncate text-sm", c.unread_count ? "font-semibold" : "font-medium")}>{name}</p>
                    <span className={cn("shrink-0 text-[11px]", c.unread_count ? "font-medium text-primary" : "text-muted")}>
                      {when(c.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {!c.ai_enabled && <BotOff className="size-3.5 shrink-0 text-muted" aria-label="AI off" />}
                    <p className="flex-1 truncate text-xs text-muted">{c.last_message_preview}</p>
                    {c.unread_count > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {!visible.length && (
          <li className="px-6 py-12 text-center text-sm text-muted">
            {conversations.length ? "No conversations match." : "No conversations yet."}
          </li>
        )}
      </ul>
    </div>
  );
}
