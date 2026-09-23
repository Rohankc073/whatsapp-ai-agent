import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BroadcastDetail } from "@/components/broadcasts/BroadcastDetail";
import type { Broadcast, BroadcastRecipient } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [b, r] = await Promise.all([
    supabase.from("broadcasts").select("*").eq("id", id).maybeSingle(),
    supabase.from("broadcast_recipients").select("*").eq("broadcast_id", id).order("name", { nullsFirst: false }),
  ]);
  if (!b.data) notFound();
  return <BroadcastDetail initial={b.data as Broadcast} initialRecipients={(r.data ?? []) as BroadcastRecipient[]} />;
}
