// Helpers for WhatsApp message templates (as returned by the Graph API).

export interface TemplateButton {
  type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER" | "COPY_CODE" | string;
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  buttons?: TemplateButton[];
}

export interface WaTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  parameter_format?: "POSITIONAL" | "NAMED";
  components: TemplateComponent[];
}

/** One blank the user has to fill for a template. */
export interface TemplateSlot {
  key: string; // e.g. "body:1", "header:1", "button:0"
  component: "header" | "body" | "button";
  param: string; // "1" or a named param like "first_name"
  label: string;
}

const VAR_RE = /\{\{\s*([\w]+)\s*\}\}/g;

function vars(text: string | undefined): string[] {
  if (!text) return [];
  return [...new Set([...text.matchAll(VAR_RE)].map((m) => m[1]))];
}

export function headerMediaFormat(t: WaTemplate): "IMAGE" | "VIDEO" | "DOCUMENT" | null {
  const h = t.components.find((c) => c.type === "HEADER");
  return h && (h.format === "IMAGE" || h.format === "VIDEO" || h.format === "DOCUMENT") ? h.format : null;
}

/** List every blank in a template: header text vars, body vars and dynamic URL button suffixes. */
export function templateSlots(t: WaTemplate): TemplateSlot[] {
  const slots: TemplateSlot[] = [];
  const header = t.components.find((c) => c.type === "HEADER");
  if (header?.format === "TEXT") {
    for (const v of vars(header.text)) slots.push({ key: `header:${v}`, component: "header", param: v, label: `Header {{${v}}}` });
  }
  const body = t.components.find((c) => c.type === "BODY");
  for (const v of vars(body?.text)) slots.push({ key: `body:${v}`, component: "body", param: v, label: `{{${v}}}` });

  const buttons = t.components.find((c) => c.type === "BUTTONS")?.buttons ?? [];
  buttons.forEach((b, i) => {
    if (b.type === "URL" && b.url && vars(b.url).length) {
      slots.push({ key: `button:${i}`, component: "button", param: String(i), label: `"${b.text}" link ending` });
    }
  });
  return slots;
}

function fill(text: string, component: string, values: Record<string, string>) {
  return text.replace(VAR_RE, (_, v) => values[`${component}:${v}`] ?? `{{${v}}}`);
}

/** Build the `components` array for the send-message API. `values` must already be filled per recipient. */
export function buildTemplateComponents(t: WaTemplate, values: Record<string, string>, headerMediaUrl?: string) {
  const named = t.parameter_format === "NAMED";
  const param = (name: string, text: string) => (named ? { type: "text", parameter_name: name, text } : { type: "text", text });
  const components: Record<string, unknown>[] = [];

  const media = headerMediaFormat(t);
  if (media) {
    const key = media.toLowerCase();
    components.push({ type: "header", parameters: [{ type: key, [key]: { link: headerMediaUrl } }] });
  }

  const slots = templateSlots(t);
  const headerSlots = slots.filter((s) => s.component === "header");
  if (headerSlots.length) {
    components.push({ type: "header", parameters: headerSlots.map((s) => param(s.param, values[s.key] ?? "")) });
  }
  const bodySlots = slots.filter((s) => s.component === "body");
  if (bodySlots.length) {
    components.push({ type: "body", parameters: bodySlots.map((s) => param(s.param, values[s.key] ?? "")) });
  }
  for (const s of slots.filter((s) => s.component === "button")) {
    components.push({ type: "button", sub_type: "url", index: s.param, parameters: [{ type: "text", text: values[s.key] ?? "" }] });
  }
  return components;
}

/** Plain-text rendering of the filled template, used for previews and the conversation log. */
export function renderTemplate(t: WaTemplate, values: Record<string, string>): string {
  const parts: string[] = [];
  for (const c of t.components) {
    if (c.type === "HEADER" && c.format === "TEXT" && c.text) parts.push(`*${fill(c.text, "header", values)}*`);
    if (c.type === "HEADER" && c.format && c.format !== "TEXT") parts.push(`[${c.format.toLowerCase()}]`);
    if (c.type === "BODY" && c.text) parts.push(fill(c.text, "body", values));
    if (c.type === "FOOTER" && c.text) parts.push(`_${c.text}_`);
    if (c.type === "BUTTONS" && c.buttons?.length) parts.push(c.buttons.map((b) => `[${b.text}]`).join(" "));
  }
  return parts.join("\n\n");
}
