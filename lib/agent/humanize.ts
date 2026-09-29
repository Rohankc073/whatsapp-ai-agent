/**
 * Strip tell-tale AI formatting from a reply so it reads like a normal text message.
 * Only applied to AI-written replies — the owner's fixed rule texts are sent as written.
 */
export function humanizeReply(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/__(.+?)__/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "") // headings
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "") // list markers
    .replace(/\s*[—–]\s*/g, ", ") // em/en dashes
    .replace(/,\s*,/g, ",")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * How long a person would plausibly take to type `reply`, in ms.
 * Roughly 1.2–6s with a little randomness so replies don't arrive at a fixed pace.
 * Time spent generating the reply counts towards it, so usually little extra wait is added.
 */
export function typingDelayMs(reply: string, random = Math.random): number {
  const base = 800 + reply.length * 25;
  const clamped = Math.min(Math.max(base, 1200), 6000);
  return Math.round(clamped * (0.85 + random() * 0.3));
}
