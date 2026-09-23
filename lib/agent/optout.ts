import { normalize } from "./rules";

const STOP = new Set(["stop", "unsubscribe", "opt out", "optout", "stop messages"]);
const START = new Set(["start", "subscribe", "unstop"]);

export function optOutIntent(text: string | null): "stop" | "start" | null {
  if (!text) return null;
  const t = normalize(text);
  if (STOP.has(t)) return "stop";
  if (START.has(t)) return "start";
  return null;
}

export const OPT_OUT_REPLY =
  "You've been unsubscribed and won't receive promotional messages from us. You can still message us here anytime — reply START to subscribe again.";
export const OPT_IN_REPLY = "You're subscribed again. Thanks!";
