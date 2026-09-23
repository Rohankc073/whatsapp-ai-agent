import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySignature } from "@/lib/whatsapp/signature";
import { parseWebhook } from "@/lib/whatsapp/parse";
import { parseAiOutput } from "@/lib/agent/ai";
import type { WebhookPayload } from "@/lib/whatsapp/types";

describe("verifySignature", () => {
  const secret = "s3cret";
  const body = JSON.stringify({ hello: "world" });
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a valid signature", () => {
    expect(verifySignature(body, sig, secret)).toBe(true);
  });
  it("rejects tampered body, wrong secret, missing or malformed header", () => {
    expect(verifySignature(body + " ", sig, secret)).toBe(false);
    expect(verifySignature(body, sig, "other")).toBe(false);
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, "sha1=abc", secret)).toBe(false);
    expect(verifySignature(body, "sha256=zz", secret)).toBe(false);
  });
});

const payload = (value: object): WebhookPayload => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: "messages", value: { metadata: { display_phone_number: "1", phone_number_id: "PNID" }, ...value } }] }],
});

describe("parseWebhook", () => {
  it("parses a text message with contact name", () => {
    const { inbound, statuses } = parseWebhook(
      payload({
        contacts: [{ profile: { name: "Asha" }, wa_id: "919999999999" }],
        messages: [{ from: "919999999999", id: "wamid.1", timestamp: "1", type: "text", text: { body: " Hi there " } }],
      }),
      "PNID"
    );
    expect(statuses).toEqual([]);
    expect(inbound).toHaveLength(1);
    expect(inbound[0]).toMatchObject({ waMessageId: "wamid.1", from: "919999999999", contactName: "Asha", text: "Hi there" });
  });

  it("parses a lead-form (click-to-WhatsApp ad) message as normal text", () => {
    const { inbound } = parseWebhook(
      payload({
        messages: [
          {
            from: "1",
            id: "wamid.2",
            timestamp: "1",
            type: "text",
            text: { body: "Name: Ravi\nIdea: Cloud kitchen\nI want funding" },
            referral: { source_type: "ad", headline: "Get funded" },
          },
        ],
      })
    );
    expect(inbound[0].text).toContain("Cloud kitchen");
  });

  it("extracts button and interactive replies; media has no text", () => {
    const { inbound } = parseWebhook(
      payload({
        messages: [
          { from: "1", id: "a", timestamp: "1", type: "button", button: { text: "Yes" } },
          { from: "1", id: "b", timestamp: "1", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "x", title: "Option A" } } },
          { from: "1", id: "c", timestamp: "1", type: "image" },
        ],
      })
    );
    expect(inbound.map((m) => m.text)).toEqual(["Yes", "Option A", null]);
  });

  it("parses statuses with errors", () => {
    const { statuses } = parseWebhook(
      payload({
        statuses: [
          { id: "wamid.9", status: "failed", timestamp: "1", recipient_id: "1", errors: [{ code: 131047, title: "Re-engagement message" }] },
        ],
      })
    );
    expect(statuses[0]).toEqual({ waMessageId: "wamid.9", status: "failed", error: "131047: Re-engagement message" });
  });

  it("ignores events for a different phone number", () => {
    const { inbound } = parseWebhook(
      payload({ messages: [{ from: "1", id: "a", timestamp: "1", type: "text", text: { body: "hi" } }] }),
      "OTHER"
    );
    expect(inbound).toEqual([]);
  });
});

describe("parseAiOutput", () => {
  it("parses JSON output", () => {
    expect(parseAiOutput('{"reply":"Hi!","handoff":false,"rule_id":null}')).toEqual({ reply: "Hi!", handoff: false, ruleId: null });
    expect(parseAiOutput('{"reply":"x","handoff":true,"rule_id":"r1"}')).toEqual({ reply: "x", handoff: true, ruleId: "r1" });
  });
  it("falls back to raw text if not JSON", () => {
    expect(parseAiOutput("Hello there")).toEqual({ reply: "Hello there", handoff: false, ruleId: null });
  });
  it("throws on empty output", () => {
    expect(() => parseAiOutput("")).toThrow();
  });
});
