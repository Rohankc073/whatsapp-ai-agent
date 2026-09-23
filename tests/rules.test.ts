import { describe, expect, it } from "vitest";
import { matchRules, normalize, ruleMatches } from "@/lib/agent/rules";
import type { ReplyRule } from "@/lib/types";

const rule = (p: Partial<ReplyRule>): ReplyRule => ({
  id: p.id ?? Math.random().toString(),
  name: "r",
  match_type: "contains",
  trigger: "",
  response_mode: "fixed",
  response: "reply",
  priority: 100,
  active: true,
  ...p,
});

describe("normalize", () => {
  it("lowercases, strips punctuation and emoji, collapses spaces", () => {
    expect(normalize("  Hello!!  👋  There? ")).toBe("hello there");
  });
});

describe("ruleMatches", () => {
  it("exact matches any alternative, ignoring case/punctuation", () => {
    const r = rule({ match_type: "exact", trigger: "hi | hello" });
    expect(ruleMatches(r, "Hello!")).toBe(true);
    expect(ruleMatches(r, "hello there")).toBe(false);
  });

  it("contains matches whole words/phrases only", () => {
    const r = rule({ match_type: "contains", trigger: "hi" });
    expect(ruleMatches(r, "oh hi there")).toBe(true);
    expect(ruleMatches(r, "this is it")).toBe(false);
    const p = rule({ match_type: "contains", trigger: "minimum investment" });
    expect(ruleMatches(p, "What is the MINIMUM investment?")).toBe(true);
  });

  it("starts_with", () => {
    const r = rule({ match_type: "starts_with", trigger: "price" });
    expect(ruleMatches(r, "Price please")).toBe(true);
    expect(ruleMatches(r, "pricey")).toBe(false);
    expect(ruleMatches(r, "what price")).toBe(false);
  });

  it("supports alternatives on new lines", () => {
    const r = rule({ match_type: "contains", trigger: "sell my business\nbuy my company" });
    expect(ruleMatches(r, "Can you buy my company?")).toBe(true);
  });

  it("intent rules never keyword-match", () => {
    expect(ruleMatches(rule({ match_type: "intent", trigger: "hello" }), "hello")).toBe(false);
  });
});

describe("matchRules", () => {
  it("returns the highest-priority fixed match", () => {
    const a = rule({ id: "a", trigger: "invest", priority: 20 });
    const b = rule({ id: "b", trigger: "invest", priority: 10 });
    expect(matchRules("I want to invest", [a, b]).fixed?.id).toBe("b");
  });

  it("ignores inactive rules", () => {
    const a = rule({ id: "a", trigger: "invest", active: false });
    expect(matchRules("invest", [a]).fixed).toBeNull();
  });

  it("passes guide matches and intents to the AI when top match is a guide", () => {
    const g = rule({ id: "g", trigger: "invest", response_mode: "guide", priority: 1 });
    const f = rule({ id: "f", trigger: "invest", priority: 5 });
    const i = rule({ id: "i", match_type: "intent", trigger: "wants to sell" });
    const m = matchRules("invest", [g, f, i]);
    expect(m.fixed).toBeNull();
    expect(m.guides.map((r) => r.id)).toEqual(["g", "f"]);
    expect(m.intents.map((r) => r.id)).toEqual(["i"]);
  });

  it("no fixed match skips intents only when a fixed rule wins", () => {
    const f = rule({ id: "f", trigger: "hello", match_type: "exact" });
    const i = rule({ id: "i", match_type: "intent", trigger: "x" });
    expect(matchRules("hello", [f, i])).toEqual({ fixed: f, guides: [], intents: [] });
  });
});
