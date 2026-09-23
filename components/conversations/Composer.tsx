"use client";

import { useState } from "react";
import { Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Message } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function Composer({
  conversationId,
  aiEnabled,
  onSent,
}: {
  conversationId: string;
  aiEnabled: boolean;
  onSent: (m: Message) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, text: body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send");
      setText("");
      if (json.message) onSent(json.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-border bg-surface px-3 py-3 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={aiEnabled ? "Type a reply (AI is also replying to this chat)…" : "Type a reply…"}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <Button onClick={send} disabled={!text.trim() || sending} size="icon" className="size-10 rounded-xl" aria-label="Send">
          {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </div>
    </div>
  );
}
