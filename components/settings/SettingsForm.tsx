"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Copy, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Settings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";

export function SettingsForm({
  initial,
  defaultModel,
  webhookUrl,
  env,
}: {
  initial: Settings;
  defaultModel: string;
  webhookUrl: string;
  env: Record<string, boolean>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [s, setS] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .update({
        agent_name: s.agent_name,
        business_name: s.business_name,
        persona: s.persona,
        model: s.model?.trim() || null,
        fallback_message: s.fallback_message,
        handoff_message: s.handoff_message,
        unsupported_message: s.unsupported_message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  }

  async function toggleGlobal(v: boolean) {
    set("global_ai_enabled", v);
    const { error } = await supabase.from("settings").update({ global_ai_enabled: v }).eq("id", 1);
    if (error) toast.error(error.message);
    else toast.success(v ? "AI replies turned on" : "AI replies paused for all chats");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Settings" description="How your agent introduces itself and behaves" />

      <Card className="mb-6 flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-semibold">Automatic replies</p>
          <p className="mt-0.5 text-sm text-muted">
            Master switch. When off, messages are still saved and shown, but nobody gets an automatic reply.
          </p>
        </div>
        <Switch checked={s.global_ai_enabled} onCheckedChange={toggleGlobal} aria-label="Automatic replies" />
      </Card>

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader title="Agent" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Business name">
              <Input value={s.business_name} onChange={(e) => set("business_name", e.target.value)} />
            </Field>
            <Field label="Agent name">
              <Input value={s.agent_name} onChange={(e) => set("agent_name", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Personality and goal" hint="Who the agent is, its tone, and what it should try to achieve in each chat.">
                <Textarea value={s.persona} onChange={(e) => set("persona", e.target.value)} className="min-h-[140px]" />
              </Field>
            </div>
            <Field label="OpenAI model" hint={`Leave empty to use the default (${defaultModel}).`}>
              <Input value={s.model ?? ""} onChange={(e) => set("model", e.target.value)} placeholder={defaultModel} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Standard messages" />
          <div className="space-y-4 p-5">
            <Field label="Handoff message" hint="Sent when the AI passes a chat to you. AI then pauses for that chat.">
              <Textarea value={s.handoff_message} onChange={(e) => set("handoff_message", e.target.value)} className="min-h-[70px]" />
            </Field>
            <Field label="Fallback message" hint="Sent if the AI fails to generate a reply.">
              <Textarea value={s.fallback_message} onChange={(e) => set("fallback_message", e.target.value)} className="min-h-[70px]" />
            </Field>
            <Field label="Unsupported message" hint="Sent when someone sends only a photo, voice note, etc.">
              <Textarea
                value={s.unsupported_message}
                onChange={(e) => set("unsupported_message", e.target.value)}
                className="min-h-[70px]"
              />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save settings
          </Button>
        </div>
      </form>

      <Card className="mt-6">
        <CardHeader title="WhatsApp connection" description="Use these in your Meta app's WhatsApp → Configuration page." />
        <div className="space-y-4 p-5">
          <Field label="Callback URL">
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Copy"
                onClick={() => navigator.clipboard.writeText(webhookUrl).then(() => toast.success("Copied"))}
              >
                <Copy />
              </Button>
            </div>
          </Field>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(env).map(([label, ok]) => (
              <li key={label} className="flex items-center gap-2 text-sm">
                {ok ? <CheckCircle2 className="size-4 text-primary" /> : <XCircle className="size-4 text-danger" />}
                <span className={ok ? "" : "text-muted"}>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
