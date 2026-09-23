"use client";

import { useState } from "react";
import { Bot, FlaskConical, Loader2, RotateCcw, SendHorizontal, Workflow } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Turn {
  role: "user" | "assistant";
  content: string;
  meta?: { source: string; rule: { name: string } | null; handoff: boolean; guides: string[] };
}

export function TestAgent() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || loading) return;
    setText("");
    setError(null);
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: message }]);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Test failed");
      setTurns((t) => [...t, { role: "assistant", content: json.reply, meta: json }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" /> Test the agent
          </span>
        }
        description="Try a message and see the reply. Nothing is sent on WhatsApp."
        action={
          turns.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setTurns([])}>
              <RotateCcw /> Reset
            </Button>
          )
        }
      />
      <div className="max-h-[420px] min-h-[200px] space-y-2 overflow-y-auto bg-chat-bg p-4">
        {!turns.length && (
          <p className="py-12 text-center text-xs text-muted">Type a message as if you were a customer.</p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cn("flex", t.role === "user" ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm",
                t.role === "user" ? "rounded-tl-sm bg-bubble-in" : "rounded-tr-sm bg-bubble-out"
              )}
            >
              <p className="whitespace-pre-wrap break-words">{t.content}</p>
              {t.meta && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {t.meta.source === "rule" ? (
                    <Badge tone="green">
                      <Workflow className="size-3" /> Rule: {t.meta.rule?.name}
                    </Badge>
                  ) : (
                    <Badge tone="blue">
                      <Bot className="size-3" /> AI{t.meta.rule ? ` · ${t.meta.rule.name}` : ""}
                    </Badge>
                  )}
                  {t.meta.guides.map((g) => (
                    <Badge key={g}>Guided by: {g}</Badge>
                  ))}
                  {t.meta.handoff && <Badge tone="amber">Hands off to human</Badge>}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-end">
            <div className="rounded-xl bg-bubble-out px-3 py-2 shadow-sm">
              <Loader2 className="size-4 animate-spin text-muted" />
            </div>
          </div>
        )}
      </div>
      {error && <p className="border-t border-border bg-danger-soft px-4 py-2 text-xs text-danger">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Do you invest in food startups?" />
        <Button type="submit" size="icon" disabled={!text.trim() || loading} aria-label="Send test message">
          <SendHorizontal />
        </Button>
      </form>
    </Card>
  );
}
