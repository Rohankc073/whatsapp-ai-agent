"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { ReplyRule } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { RuleForm } from "./RuleForm";
import { TestAgent } from "./TestAgent";

const MATCH_LABEL: Record<ReplyRule["match_type"], string> = {
  exact: "Message is exactly",
  contains: "Message contains",
  starts_with: "Message starts with",
  intent: "Customer is",
};

export function RulesManager({ initial }: { initial: ReplyRule[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [rules, setRules] = useState(initial);
  const [editing, setEditing] = useState<ReplyRule | "new" | null>(null);

  async function save(values: Omit<ReplyRule, "id">) {
    if (editing === "new") {
      const { data, error } = await supabase.from("reply_rules").insert(values).select().single();
      if (error) return toast.error(error.message);
      setRules((r) => [...r, data as ReplyRule].sort((a, b) => a.priority - b.priority));
      toast.success("Rule added");
    } else if (editing) {
      const { data, error } = await supabase
        .from("reply_rules")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", editing.id)
        .select()
        .single();
      if (error) return toast.error(error.message);
      setRules((r) => r.map((x) => (x.id === editing.id ? (data as ReplyRule) : x)).sort((a, b) => a.priority - b.priority));
      toast.success("Rule saved");
    }
    setEditing(null);
  }

  async function toggle(rule: ReplyRule, active: boolean) {
    setRules((r) => r.map((x) => (x.id === rule.id ? { ...x, active } : x)));
    const { error } = await supabase.from("reply_rules").update({ active }).eq("id", rule.id);
    if (error) toast.error(error.message);
  }

  async function remove(rule: ReplyRule) {
    if (!confirm(`Delete the rule "${rule.name}"?`)) return;
    const { error } = await supabase.from("reply_rules").delete().eq("id", rule.id);
    if (error) return toast.error(error.message);
    setRules((r) => r.filter((x) => x.id !== rule.id));
    toast.success("Rule deleted");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Reply rules"
        description="Tell the agent: if someone messages this, reply with that. Rules are checked before the AI writes its own reply."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus /> New rule
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={rule.active ? "p-4" : "p-4 opacity-60"}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{rule.name}</p>
                    <Badge tone={rule.response_mode === "fixed" ? "green" : "blue"}>
                      {rule.response_mode === "fixed" ? "Exact reply" : "AI guided"}
                    </Badge>
                    <Badge>#{rule.priority}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
                    <div className="rounded-lg bg-surface-2 px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{MATCH_LABEL[rule.match_type]}</p>
                      <p className="mt-0.5 break-words text-sm">{rule.trigger}</p>
                    </div>
                    <ArrowRight className="mx-auto hidden size-4 text-muted sm:mt-4 sm:block" />
                    <div className="rounded-lg bg-primary-soft/60 px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                        {rule.response_mode === "fixed" ? "Reply with" : "AI should"}
                      </p>
                      <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-sm">{rule.response}</p>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Switch checked={rule.active} onCheckedChange={(v) => toggle(rule, v)} aria-label="Active" />
                  <div className="flex">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(rule)} aria-label="Edit">
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(rule)} aria-label="Delete">
                      <Trash2 className="text-danger" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {!rules.length && (
            <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <Workflow className="size-8 text-muted" />
              <p className="text-sm font-medium">No rules yet</p>
              <p className="max-w-sm text-sm text-muted">
                Without rules, the AI answers everything from your knowledge base. Add a rule to control specific replies.
              </p>
              <Button onClick={() => setEditing("new")}>
                <Plus /> Add your first rule
              </Button>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6">
            <TestAgent />
          </div>
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && (
          <RuleForm
            rule={editing === "new" ? null : editing}
            nextPriority={(rules.at(-1)?.priority ?? 0) + 10}
            onSubmit={save}
          />
        )}
      </Dialog>
    </div>
  );
}
