"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ExternalLink, Loader2, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DEFAULT_COUNTRY_CODE, parseRecipients, fillTokens } from "@/lib/broadcast/recipients";
import { headerMediaFormat, renderTemplate, templateSlots, type WaTemplate } from "@/lib/whatsapp/templates";

const TOKENS = ["{first_name}", "{name}", "{phone}"];

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{n}</span>
      {children}
    </span>
  );
}

export function NewBroadcast() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [list, setList] = useState("");
  const [templates, setTemplates] = useState<WaTemplate[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [mediaUrl, setMediaUrl] = useState("");
  const [nameFallback, setNameFallback] = useState("there");
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const parsed = useMemo(() => parseRecipients(list), [list]);
  const template = templates?.find((t) => t.id === templateId) ?? null;
  const slots = useMemo(() => (template ? templateSlots(template) : []), [template]);
  const media = template ? headerMediaFormat(template) : null;

  useEffect(() => {
    fetch("/api/templates")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load templates");
        setTemplates(json.templates);
      })
      .catch((err) => setTemplatesError(err.message));
  }, []);

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const t = templates?.find((x) => x.id === id);
    if (!t) return;
    // Sensible default: first body blank is usually the person's name.
    const s = templateSlots(t);
    const firstBody = s.find((x) => x.component === "body");
    setValues(firstBody ? { [firstBody.key]: "{first_name}" } : {});
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setList((prev) => (prev.trim() ? prev.trim() + "\n" : "") + text.trim());
    e.target.value = "";
  }

  const sample = parsed.valid[0] ?? { phone: "919876543210", name: "Ravi Kumar" };
  const preview = template
    ? renderTemplate(
        template,
        Object.fromEntries(slots.map((s) => [s.key, values[s.key] ? fillTokens(values[s.key], sample, nameFallback) : `{{${s.param}}}`]))
      )
    : "";

  const missing = slots.filter((s) => !values[s.key]?.trim());
  const canSend = parsed.valid.length > 0 && template && !missing.length && (!media || mediaUrl.startsWith("https://"));

  async function send() {
    if (!template) return;
    setSending(true);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          template: { name: template.name, language: template.language },
          values,
          headerMediaUrl: mediaUrl || undefined,
          nameFallback,
          recipients: parsed.valid,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start broadcast");
      toast.success("Broadcast started");
      router.push(`/broadcasts/${json.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start broadcast");
      setSending(false);
      setConfirming(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <Link href="/broadcasts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Broadcasts
      </Link>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">New broadcast</h1>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* 1. Recipients */}
          <Card>
            <CardHeader
              title={<StepTitle n={1}>Recipients</StepTitle>}
              description="Paste one number per line, optionally with a name. You can also upload a CSV."
              action={
                <>
                  <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onFile} />
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload /> Upload CSV
                  </Button>
                </>
              }
            />
            <div className="space-y-3 p-5">
              <Textarea
                value={list}
                onChange={(e) => setList(e.target.value)}
                className="min-h-[160px] font-mono text-xs"
                placeholder={"9876543210, Ravi Kumar\n+91 91234 56789, Priya Shah\n9988776655"}
              />
              <div className="flex flex-wrap gap-2">
                <Badge tone="green">{parsed.valid.length} valid</Badge>
                {parsed.invalid.length > 0 && <Badge tone="red">{parsed.invalid.length} invalid</Badge>}
                {parsed.duplicates.length > 0 && <Badge tone="amber">{parsed.duplicates.length} duplicate removed</Badge>}
                {parsed.valid.length > 0 && (
                  <Badge>{parsed.valid.filter((r) => r.name).length} with names</Badge>
                )}
              </div>
              {parsed.invalid.length > 0 && (
                <div className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                  <p className="font-medium">These lines have no valid phone number and will be skipped:</p>
                  <p className="mt-1 font-mono">{parsed.invalid.slice(0, 5).join(" · ")}{parsed.invalid.length > 5 ? " …" : ""}</p>
                </div>
              )}
              <p className="text-xs text-muted">10-digit numbers get the +{DEFAULT_COUNTRY_CODE} country code. Include the country code for numbers from other countries.</p>
            </div>
          </Card>

          {/* 2. Template */}
          <Card>
            <CardHeader
              title={<StepTitle n={2}>Message template</StepTitle>}
              description="Only templates approved by Meta can be sent to people who haven't messaged you in the last 24 hours."
              action={
                <a
                  href="https://business.facebook.com/wa/manage/message-templates/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Manage templates <ExternalLink className="size-3" />
                </a>
              }
            />
            <div className="space-y-4 p-5">
              {templatesError ? (
                <div className="flex gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Couldn&apos;t load templates</p>
                    <p className="text-xs">{templatesError}</p>
                  </div>
                </div>
              ) : !templates ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="size-4 animate-spin" /> Loading approved templates…
                </p>
              ) : !templates.length ? (
                <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                  No approved templates yet. Create one in WhatsApp Manager. Approval usually takes minutes to a few hours.
                </p>
              ) : (
                <Select value={templateId} onChange={(e) => chooseTemplate(e.target.value)}>
                  <option value="">Choose a template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.language}) · {t.category.toLowerCase()}
                    </option>
                  ))}
                </Select>
              )}

              {template && (
                <>
                  {media && (
                    <Field label={`Header ${media.toLowerCase()} link`} hint="A public https:// link to the file.">
                      <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" />
                    </Field>
                  )}
                  {slots.map((s) => (
                    <Field
                      key={s.key}
                      label={`Fill ${s.label}`}
                      hint={
                        <span className="flex flex-wrap items-center gap-1">
                          Insert:
                          {TOKENS.map((tok) => (
                            <button
                              key={tok}
                              type="button"
                              onClick={() => setValues((v) => ({ ...v, [s.key]: (v[s.key] ?? "") + tok }))}
                              className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:bg-primary-soft"
                            >
                              {tok}
                            </button>
                          ))}
                          {s.component === "button" && <span>· e.g. {"{phone}"} so your form knows who opened it</span>}
                        </span>
                      }
                    >
                      <Input value={values[s.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))} />
                    </Field>
                  ))}
                  {Object.values(values).some((v) => /\{(first_)?name\}/i.test(v)) && (
                    <Field label="If a name is missing, use">
                      <Input value={nameFallback} onChange={(e) => setNameFallback(e.target.value)} className="w-48" />
                    </Field>
                  )}
                  {!slots.length && !media && <p className="text-sm text-muted">This template has no blanks to fill.</p>}
                </>
              )}
            </div>
          </Card>

          {/* 3. Send */}
          <Card>
            <CardHeader title={<StepTitle n={3}>Review and send</StepTitle>} />
            <div className="space-y-4 p-5">
              <Field label="Broadcast name (for your reference)">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lead follow-up, September" />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {parsed.valid.length
                    ? `Will send ${parsed.valid.length} template message${parsed.valid.length === 1 ? "" : "s"}. Meta charges per message.`
                    : "Add recipients to continue."}
                </p>
                <Button size="lg" disabled={!canSend} onClick={() => setConfirming(true)}>
                  <Send /> Send broadcast
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6">
            <Card className="overflow-hidden">
              <CardHeader title="Preview" description={template ? `As ${sample.name || nameFallback} will see it` : "Choose a template to preview"} />
              <div className="min-h-[240px] bg-chat-bg p-4">
                {template && (
                  <div className="max-w-[90%] rounded-xl rounded-tl-sm bg-bubble-in px-3 py-2 text-sm shadow-sm">
                    <p className="whitespace-pre-wrap break-words">{preview}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={confirming} onOpenChange={(o) => !sending && setConfirming(o)}>
        {confirming && (
          <DialogContent
            title={`Send to ${parsed.valid.length} people?`}
            description="Messages start sending right away and can't be recalled. People who replied STOP before are skipped automatically."
          >
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={send} disabled={sending}>
                {sending ? <Loader2 className="animate-spin" /> : <Send />}
                Send now
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
