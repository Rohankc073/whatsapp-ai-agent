"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Loader2, MessageSquareReply } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Broadcast, BroadcastRecipient, RecipientStatus } from "@/lib/types";
import { broadcastStats } from "@/lib/broadcast/stats";
import { formatPhone } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS: Record<RecipientStatus, { label: string; tone: "neutral" | "green" | "red" | "amber" | "blue" }> = {
  queued: { label: "Queued", tone: "neutral" },
  sent: { label: "Sent", tone: "neutral" },
  delivered: { label: "Delivered", tone: "blue" },
  read: { label: "Read", tone: "green" },
  failed: { label: "Failed", tone: "red" },
  skipped: { label: "Skipped", tone: "amber" },
};

export function BroadcastDetail({ initial, initialRecipients }: { initial: Broadcast; initialRecipients: BroadcastRecipient[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [broadcast, setBroadcast] = useState(initial);
  const [recipients, setRecipients] = useState(initialRecipients);

  useEffect(() => {
    const channel = supabase
      .channel(`broadcast-${initial.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "broadcast_recipients", filter: `broadcast_id=eq.${initial.id}` },
        (p) => setRecipients((prev) => prev.map((r) => (r.id === (p.new as BroadcastRecipient).id ? (p.new as BroadcastRecipient) : r)))
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "broadcasts", filter: `id=eq.${initial.id}` }, (p) =>
        setBroadcast(p.new as Broadcast)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, initial.id]);

  const s = broadcastStats(recipients);
  const done = s.total - s.queued;
  const pct = s.total ? Math.round((done / s.total) * 100) : 0;

  const cards = [
    { label: "Recipients", value: s.total },
    { label: "Sent", value: s.sent },
    { label: "Delivered", value: s.delivered },
    { label: "Read", value: s.read },
    { label: "Replied", value: s.replied },
    { label: "Failed", value: s.failed + s.skipped, danger: s.failed > 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <Link href="/broadcasts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Broadcasts
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{broadcast.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {broadcast.template_name} · {format(new Date(broadcast.created_at), "d MMM yyyy, HH:mm")}
          </p>
        </div>
        {broadcast.status === "sending" ? (
          <Badge tone="blue" className="px-3 py-1">
            <Loader2 className="size-3.5 animate-spin" /> Sending {done}/{s.total}
          </Badge>
        ) : (
          <Badge tone="green" className="px-3 py-1">Completed</Badge>
        )}
      </div>

      {broadcast.status === "sending" && (
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-xs font-medium text-muted">{c.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${c.danger ? "text-danger" : ""}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader title="Recipients" />
          <ul className="divide-y divide-border">
            {recipients.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name || formatPhone(r.wa_id)}</p>
                  <p className="truncate text-xs text-muted">
                    {r.name ? formatPhone(r.wa_id) : ""}
                    {r.error && <span className="text-danger">{r.name ? " · " : ""}{r.error}</span>}
                  </p>
                </div>
                {r.replied_at && (
                  <Badge tone="green">
                    <MessageSquareReply className="size-3" /> Replied
                  </Badge>
                )}
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                {r.conversation_id && (
                  <Link href={`/conversations?c=${r.conversation_id}`} className="text-xs font-medium text-primary hover:underline">
                    Chat
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="h-fit overflow-hidden">
          <CardHeader title="Message" description="As sent to the first recipient" />
          <div className="bg-chat-bg p-4">
            <div className="rounded-xl rounded-tl-sm bg-bubble-in px-3 py-2 text-sm shadow-sm">
              <p className="whitespace-pre-wrap break-words">{broadcast.preview}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
