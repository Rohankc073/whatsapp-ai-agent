import { describe, expect, it } from "vitest";
import { humanizeReply, typingDelayMs } from "@/lib/agent/humanize";

describe("humanizeReply", () => {
  it("removes markdown, list markers and dashes", () => {
    expect(humanizeReply("**Sure** — we invest in ideas.\n- no loans\n1. equity only")).toBe("Sure, we invest in ideas.\nno loans\nequity only");
  });
  it("doesn't leave a comma before punctuation", () => {
    expect(humanizeReply("We'll check —.")).toBe("We'll check.");
  });
  it("leaves normal text alone", () => {
    expect(humanizeReply("Got it, what stage is the business at?")).toBe("Got it, what stage is the business at?");
  });
});

describe("typingDelayMs", () => {
  it("stays between ~1s and ~7s and grows with length", () => {
    const mid = () => 0.5;
    expect(typingDelayMs("ok", mid)).toBe(1200);
    expect(typingDelayMs("x".repeat(100), mid)).toBe(3300);
    expect(typingDelayMs("x".repeat(1000), mid)).toBe(6000);
    expect(typingDelayMs("ok", () => 0)).toBeGreaterThanOrEqual(1000);
    expect(typingDelayMs("x".repeat(1000), () => 1)).toBeLessThanOrEqual(6900);
  });
});
