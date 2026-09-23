"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChatList } from "./ChatList";
import { ChatThread } from "./ChatThread";
import { MessagesSquare } from "lucide-react";

export function ConversationsView({ initial, initialSelected }: { initial: Conversation[]; initialSelected: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [conversations, setConversations] = useState<Conversation[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected);

  // Live list updates
  useEffect(() => {
    const channel = supabase
      .channel("conversations-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, async (payload) => {
        if (payload.eventType === "DELETE") {
          setConversations((prev) => prev.filter((c) => c.id !== (payload.old as Conversation).id));
          return;
        }
        const row = payload.new as Conversation;
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === row.id);
          if (existing) return prev.map((c) => (c.id === row.id ? { ...row, contact: c.contact } : c));
          return prev;
        });
        if (payload.eventType === "INSERT") {
          const { data } = await supabase.from("conversations").select("*, contact:contacts(*)").eq("id", row.id).single();
          if (data) setConversations((prev) => (prev.some((c) => c.id === data.id) ? prev : [data as Conversation, ...prev]));
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at)),
    [conversations]
  );
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  function select(id: string | null) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("c", id);
    else url.searchParams.delete("c");
    window.history.replaceState(null, "", url);
  }

  const patchLocal = useCallback((id: string, patch: Partial<Conversation>) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  return (
    <div className="flex h-full min-h-0">
      <div className={cn("w-full shrink-0 border-r border-border bg-surface md:w-80 lg:w-96", selected && "hidden md:flex")}>
        <ChatList conversations={sorted} selectedId={selectedId} onSelect={select} />
      </div>
      <div className={cn("min-w-0 flex-1", !selected && "hidden md:flex")}>
        {selected ? (
          <ChatThread key={selected.id} conversation={selected} onBack={() => select(null)} onPatch={patchLocal} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-chat-bg text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-surface shadow-sm">
              <MessagesSquare className="size-6 text-muted" />
            </div>
            <div>
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="mt-1 text-xs text-muted">New messages appear here in real time</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
