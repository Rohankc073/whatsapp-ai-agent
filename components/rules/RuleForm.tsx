"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { MatchType, ReplyRule, ResponseMode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MATCH_HINT: Record<MatchType, string> = {
  exact: 'Whole message must equal a trigger (case and punctuation ignored). Separate alternatives with "|", e.g. hi | hello | hey',
  contains: 'Message contains the word or phrase anywhere, e.g. minimum investment | how much money',
  starts_with: "Message begins with the word or phrase.",
  intent: 'Describe the situation in plain words — the AI decides if it applies, e.g. "asking whether we buy businesses"',
};

export function RuleForm({
  rule,
  nextPriority,
  onSubmit,
}: {
  rule: ReplyRule | null;
  nextPriority: number;
  onSubmit: (values: Omit<ReplyRule, "id">) => Promise<unknown>;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [matchType, setMatchType] = useState<MatchType>(rule?.match_type ?? "contains");
  const [trigger, setTrigger] = useState(rule?.trigger ?? "");
  const [mode, setMode] = useState<ResponseMode>(rule?.response_mode ?? "fixed");
  const [response, setResponse] = useState(rule?.response ?? "");
  const [priority, setPriority] = useState(rule?.priority ?? nextPriority);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSubmit({
      name: name.trim(),
      match_type: matchType,
      trigger: trigger.trim(),
      response_mode: mode,
      response: response.trim(),
      priority: Number(priority) || 100,
      active: rule?.active ?? true,
    });
    setSaving(false);
  }

  return (
    <DialogContent
      title={rule ? "Edit rule" : "New rule"}
      description="If someone messages this → reply with that."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Rule name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Minimum investment question" />
        </Field>

        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">If someone messages…</p>
          <div className="space-y-3">
            <Select value={matchType} onChange={(e) => setMatchType(e.target.value as MatchType)}>
              <option value="contains">Message contains</option>
              <option value="exact">Message is exactly</option>
              <option value="starts_with">Message starts with</option>
              <option value="intent">Customer is… (AI understands meaning)</option>
            </Select>
            <Field label={matchType === "intent" ? "Situation" : "Trigger words"} hint={MATCH_HINT[matchType]}>
              <Textarea
                required
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="min-h-[60px]"
                placeholder={matchType === "intent" ? "asking whether we also buy businesses" : "minimum investment | how much"}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">…then</p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(
              [
                ["fixed", "Send this exact reply", "Word-for-word, no AI"],
                ["guide", "Guide the AI", "AI writes the reply following your instruction"],
              ] as const
            ).map(([value, title, desc]) => (
              <button
                type="button"
                key={value}
                onClick={() => setMode(value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  mode === value ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2"
                )}
              >
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted">{desc}</p>
              </button>
            ))}
          </div>
          <Field label={mode === "fixed" ? "Reply" : "Instruction for the AI"}>
            <Textarea
              required
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className="min-h-[110px]"
              placeholder={
                mode === "fixed"
                  ? "There's no fixed minimum — we look at every idea on its merits. Could you tell me a bit about yours?"
                  : "Explain there is no fixed minimum, then ask what stage their business is at."
              }
            />
          </Field>
        </div>

        <Field label="Priority" hint="Lower number is checked first when several rules match.">
          <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="w-32" />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {rule ? "Save rule" : "Add rule"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
