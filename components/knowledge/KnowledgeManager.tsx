"use client";

import { useMemo, useState } from "react";
import { BookOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { KnowledgeEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

export function KnowledgeManager({ initial }: { initial: KnowledgeEntry[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState(initial);
  const [editing, setEditing] = useState<KnowledgeEntry | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  function open(entry: KnowledgeEntry | "new") {
    setEditing(entry);
    setTitle(entry === "new" ? "" : entry.title);
    setContent(entry === "new" ? "" : entry.content);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const values = { title: title.trim(), content: content.trim() };
    if (editing === "new") {
      const { data, error } = await supabase.from("knowledge_base").insert(values).select().single();
      if (error) toast.error(error.message);
      else {
        setEntries((x) => [...x, data as KnowledgeEntry]);
        setEditing(null);
        toast.success("Entry added");
      }
    } else if (editing) {
      const { data, error } = await supabase
        .from("knowledge_base")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", editing.id)
        .select()
        .single();
      if (error) toast.error(error.message);
      else {
        setEntries((x) => x.map((k) => (k.id === editing.id ? (data as KnowledgeEntry) : k)));
        setEditing(null);
        toast.success("Entry saved");
      }
    }
    setSaving(false);
  }

  async function toggle(entry: KnowledgeEntry, active: boolean) {
    setEntries((x) => x.map((k) => (k.id === entry.id ? { ...k, active } : k)));
    const { error } = await supabase.from("knowledge_base").update({ active }).eq("id", entry.id);
    if (error) toast.error(error.message);
  }

  async function remove(entry: KnowledgeEntry) {
    if (!confirm(`Delete "${entry.title}"?`)) return;
    const { error } = await supabase.from("knowledge_base").delete().eq("id", entry.id);
    if (error) return toast.error(error.message);
    setEntries((x) => x.filter((k) => k.id !== entry.id));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Knowledge"
        description="Facts about your business the AI uses to answer questions. It will not state anything that isn't here."
        action={
          <Button onClick={() => open("new")}>
            <Plus /> Add entry
          </Button>
        }
      />

      <div className="space-y-3">
        {entries.map((k) => (
          <Card key={k.id} className={k.active ? "p-5" : "p-5 opacity-60"}>
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{k.title}</p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">{k.content}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Switch checked={k.active} onCheckedChange={(v) => toggle(k, v)} aria-label="Active" />
                <div className="flex">
                  <Button variant="ghost" size="icon" onClick={() => open(k)} aria-label="Edit">
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(k)} aria-label="Delete">
                    <Trash2 className="text-danger" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {!entries.length && (
          <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <BookOpen className="size-8 text-muted" />
            <p className="text-sm font-medium">No knowledge yet</p>
            <p className="max-w-sm text-sm text-muted">Add what your firm does, how the process works and common questions.</p>
          </Card>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && (
          <DialogContent
            title={editing === "new" ? "Add knowledge" : "Edit knowledge"}
            description="Write it plainly, as you would explain it to a new team member."
          >
            <form onSubmit={save} className="space-y-4">
              <Field label="Title">
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Minimum investment" />
              </Field>
              <Field label="Content">
                <Textarea required value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[180px]" />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
