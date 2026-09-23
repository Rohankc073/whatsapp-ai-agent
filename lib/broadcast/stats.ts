import type { RecipientStatus } from "@/lib/types";

export function broadcastStats(rows: { status: RecipientStatus; replied_at: string | null }[]) {
  const count = (...s: RecipientStatus[]) => rows.filter((r) => s.includes(r.status)).length;
  return {
    total: rows.length,
    queued: count("queued"),
    sent: count("sent", "delivered", "read"),
    delivered: count("delivered", "read"),
    read: count("read"),
    failed: count("failed"),
    skipped: count("skipped"),
    replied: rows.filter((r) => r.replied_at).length,
  };
}
