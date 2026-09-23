import { describe, expect, it } from "vitest";
import { fillTokens, normalizePhone, parseRecipients } from "@/lib/broadcast/recipients";
import { buildTemplateComponents, renderTemplate, templateSlots, type WaTemplate } from "@/lib/whatsapp/templates";
import { optOutIntent } from "@/lib/agent/optout";
import { broadcastStats } from "@/lib/broadcast/stats";

describe("normalizePhone", () => {
  it.each([
    ["9876543210", "919876543210"],
    ["+91 98765 43210", "919876543210"],
    ["098765 43210", "919876543210"],
    ["919876543210", "919876543210"],
    ["+1 (415) 555-0100", "14155550100"],
    ["0044 7911 123456", "447911123456"],
  ])("%s → %s", (input, out) => expect(normalizePhone(input, "91")).toBe(out));

  it.each(["12345", "Ravi", "abc9876543210", ""])("rejects %s", (input) => expect(normalizePhone(input, "91")).toBeNull());
});

describe("parseRecipients", () => {
  it("handles phone/name in either order, dedupes and flags invalid lines", () => {
    const r = parseRecipients("9876543210, Ravi Kumar\nPriya Shah, +91 91234 56789\n98765 43210\nhello\n9988776655", "91");
    expect(r.valid).toEqual([
      { phone: "919876543210", name: "Ravi Kumar" },
      { phone: "919123456789", name: "Priya Shah" },
      { phone: "919988776655", name: null },
    ]);
    expect(r.duplicates).toEqual(["919876543210"]);
    expect(r.invalid).toEqual(["hello"]);
  });

  it("reads a CSV with header, quotes and extra columns (ignores email)", () => {
    const csv = 'Full Name,Email,Phone Number,City\n"Kumar, Ravi",ravi@x.com,9876543210,Pune\nAsha,asha@y.com,+919123456789,Delhi';
    const r = parseRecipients(csv, "91");
    expect(r.invalid).toEqual([]);
    expect(r.valid).toEqual([
      { phone: "919876543210", name: "Kumar, Ravi" },
      { phone: "919123456789", name: "Asha" },
    ]);
  });
});

describe("fillTokens", () => {
  it("fills name, first name and phone with a fallback", () => {
    expect(fillTokens("Hi {first_name} ({name}) {phone}", { phone: "91", name: "Ravi Kumar" })).toBe("Hi Ravi (Ravi Kumar) 91");
    expect(fillTokens("Hi {first_name}", { phone: "91", name: null }, "there")).toBe("Hi there");
  });
});

const positional: WaTemplate = {
  id: "1",
  name: "lead_followup",
  language: "en",
  status: "APPROVED",
  category: "UTILITY",
  components: [
    { type: "HEADER", format: "IMAGE" },
    { type: "BODY", text: "Hi {{1}}, thanks for filling our form. Team {{2}} will call." },
    { type: "FOOTER", text: "Reply STOP to opt out" },
    {
      type: "BUTTONS",
      buttons: [
        { type: "URL", text: "Fill the form", url: "https://example.com/apply?ref={{1}}" },
        { type: "QUICK_REPLY", text: "Not interested" },
      ],
    },
  ],
};

describe("templates", () => {
  it("lists body and dynamic URL button slots", () => {
    expect(templateSlots(positional).map((s) => s.key)).toEqual(["body:1", "body:2", "button:0"]);
  });

  it("builds positional components with header media and URL button", () => {
    const c = buildTemplateComponents(positional, { "body:1": "Ravi", "body:2": "Ideas", "button:0": "919876543210" }, "https://x.com/a.png");
    expect(c).toEqual([
      { type: "header", parameters: [{ type: "image", image: { link: "https://x.com/a.png" } }] },
      { type: "body", parameters: [{ type: "text", text: "Ravi" }, { type: "text", text: "Ideas" }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "919876543210" }] },
    ]);
  });

  it("uses parameter_name for NAMED templates", () => {
    const named: WaTemplate = {
      ...positional,
      parameter_format: "NAMED",
      components: [{ type: "BODY", text: "Hi {{first_name}}!" }],
    };
    expect(templateSlots(named).map((s) => s.key)).toEqual(["body:first_name"]);
    expect(buildTemplateComponents(named, { "body:first_name": "Ravi" })).toEqual([
      { type: "body", parameters: [{ type: "text", parameter_name: "first_name", text: "Ravi" }] },
    ]);
  });

  it("renders a readable preview", () => {
    expect(renderTemplate(positional, { "body:1": "Ravi", "body:2": "Ideas" })).toBe(
      "[image]\n\nHi Ravi, thanks for filling our form. Team Ideas will call.\n\n_Reply STOP to opt out_\n\n[Fill the form] [Not interested]"
    );
  });
});

describe("optOutIntent", () => {
  it("detects STOP/START only as the whole message", () => {
    expect(optOutIntent("STOP")).toBe("stop");
    expect(optOutIntent("Unsubscribe.")).toBe("stop");
    expect(optOutIntent("start")).toBe("start");
    expect(optOutIntent("please don't stop, tell me more")).toBeNull();
    expect(optOutIntent(null)).toBeNull();
  });
});

describe("broadcastStats", () => {
  it("counts cumulative delivery states", () => {
    const s = broadcastStats([
      { status: "read", replied_at: "x" },
      { status: "delivered", replied_at: null },
      { status: "sent", replied_at: null },
      { status: "failed", replied_at: null },
      { status: "queued", replied_at: null },
    ]);
    expect(s).toMatchObject({ total: 5, sent: 3, delivered: 2, read: 1, failed: 1, queued: 1, replied: 1 });
  });
});
