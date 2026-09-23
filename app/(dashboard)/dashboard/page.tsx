import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Bot, Inbox, MessagesSquare, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { MessagesChart } from "@/components/dashboard/messages-chart";
import { formatPhone, initials } from "@/lib/utils";
import type { Conversation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = { count: "exact" as const, head: true };

  const [activeChats, inbound, outbound, automated, needsHuman, daily, recent, settings] = await Promise.all([
    supabase.from("conversations").select("id", count).gte("last_inbound_at", since),
    supabase.from("messages").select("id", count).eq("direction", "in").gte("created_at", since),
    supabase.from("messages").select("id", count).eq("direction", "out").gte("created_at", since),
    supabase.from("messages").select("id", count).eq("direction", "out").in("sender", ["ai", "rule"]).gte("created_at", since),
    supabase.from("conversations").select("id", count).eq("needs_human", true),
    supabase.rpc("message_daily_counts", { p_days: 14 }),
    supabase
      .from("conversations")
      .select("*, contact:contacts(*)")
      .order("last_message_at", { ascending: false })
      .limit(6),
    supabase.from("settings").select("global_ai_enabled").eq("id", 1).single(),
  ]);

  const out = outbound.count ?? 0;
  const autoRate = out ? Math.round(((automated.count ?? 0) / out) * 100) : null;
  const aiOn = settings.data?.global_ai_enabled ?? false;

  const stats = [
    { label: "Active chats", value: activeChats.count ?? 0, icon: MessagesSquare, hint: "last 24 hours" },
    { label: "Messages received", value: inbound.count ?? 0, icon: Inbox, hint: "last 24 hours" },
    { label: "Replies sent", value: out, icon: Send, hint: autoRate === null ? "last 24 hours" : `${autoRate}% automated` },
    {
      label: "Needs a human",
      value: needsHuman.count ?? 0,
      icon: AlertTriangle,
      hint: "AI handed over",
      alert: (needsHuman.count ?? 0) > 0,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Overview"
        description="How your WhatsApp agent is doing"
        action={
          <Link href="/settings">
            <Badge tone={aiOn ? "green" : "red"} className="px-3 py-1">
              <Bot className="size-3.5" />
              {aiOn ? "AI replies on" : "AI replies paused"}
            </Badge>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted">{s.label}</p>
              <s.icon className={s.alert ? "size-4 text-warning" : "size-4 text-muted"} />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted">{s.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Messages" description="Received vs. sent, last 14 days" />
          <div className="p-4">
            <MessagesChart data={(daily.data ?? []).map((d: { day: string; inbound: number; outbound: number }) => ({
              day: d.day,
              inbound: Number(d.inbound),
              outbound: Number(d.outbound),
            }))} />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent conversations"
            action={
              <Link href="/conversations" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            }
          />
          <ul className="divide-y divide-border">
            {((recent.data ?? []) as Conversation[]).map((c) => {
              const name = c.contact?.name || formatPhone(c.contact?.wa_id ?? "");
              return (
                <li key={c.id}>
                  <Link href={`/conversations?c=${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                      {initials(c.contact?.name, c.contact?.wa_id ?? "")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <span className="shrink-0 text-xs text-muted">
                          {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted">{c.last_message_preview}</p>
                    </div>
                    {c.needs_human && <Badge tone="amber">Human</Badge>}
                  </Link>
                </li>
              );
            })}
            {!recent.data?.length && (
              <li className="px-5 py-10 text-center text-sm text-muted">
                No conversations yet. Messages will show up here as soon as someone texts your number.
              </li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
