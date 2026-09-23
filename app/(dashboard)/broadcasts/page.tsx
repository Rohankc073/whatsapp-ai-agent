import Link from "next/link";
import { format } from "date-fns";
import { Loader2, Megaphone, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { broadcastStats } from "@/lib/broadcast/stats";
import type { Broadcast, BroadcastRecipient } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = Broadcast & { broadcast_recipients: Pick<BroadcastRecipient, "status" | "replied_at">[] };

export default async function BroadcastsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("broadcasts")
    .select("*, broadcast_recipients(status, replied_at)")
    .order("created_at", { ascending: false })
    .limit(100);
  const broadcasts = (data ?? []) as Row[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Broadcasts"
        description="Send the same approved template to many numbers at once. Each person gets a private message, and their replies go to the AI agent."
        action={
          <Button asChild>
            <Link href="/broadcasts/new">
              <Plus /> New broadcast
            </Link>
          </Button>
        }
      />

      {broadcasts.length ? (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {broadcasts.map((b) => {
              const s = broadcastStats(b.broadcast_recipients);
              return (
                <li key={b.id}>
                  <Link href={`/broadcasts/${b.id}`} className="flex flex-col gap-3 px-5 py-4 hover:bg-surface-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{b.name}</p>
                        {b.status === "sending" && (
                          <Badge tone="blue">
                            <Loader2 className="size-3 animate-spin" /> Sending
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {b.template_name} · {format(new Date(b.created_at), "d MMM yyyy, HH:mm")}
                      </p>
                    </div>
                    <div className="grid grid-cols-5 gap-4 text-center text-xs">
                      {[
                        ["Recipients", s.total],
                        ["Delivered", s.delivered],
                        ["Read", s.read],
                        ["Replied", s.replied],
                        ["Failed", s.failed],
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <p className={`text-sm font-semibold tabular-nums ${label === "Failed" && value ? "text-danger" : ""}`}>{value}</p>
                          <p className="text-muted">{label}</p>
                        </div>
                      ))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
            <Megaphone className="size-6 text-primary" />
          </div>
          <p className="text-sm font-medium">No broadcasts yet</p>
          <p className="max-w-md text-sm text-muted">
            Create a message template in WhatsApp Manager and wait for Meta to approve it. Then send it here to a list of numbers.
          </p>
          <Button asChild>
            <Link href="/broadcasts/new">
              <Plus /> New broadcast
            </Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
