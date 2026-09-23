export interface Recipient {
  phone: string; // digits only, with country code, e.g. 919876543210
  name: string | null;
}

export const DEFAULT_COUNTRY_CODE = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || "91";

/**
 * Normalise a phone number to WhatsApp's format (country code + number, digits only).
 * 10-digit numbers get the default country code; a leading 0 or 00 is handled.
 */
export function normalizePhone(input: string, defaultCc = DEFAULT_COUNTRY_CODE): string | null {
  const raw = input.trim();
  if (!/^[+\d][\d\s().-]*$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) {
    // already international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = defaultCc + digits.slice(1);
  } else if (digits.length === 10) {
    digits = defaultCc + digits;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** Split one CSV/TSV line, respecting double quotes. */
export function splitLine(line: string): string[] {
  const delimiter = line.includes("\t") ? "\t" : line.includes(";") && !line.includes(",") ? ";" : ",";
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/**
 * Parse pasted text or CSV content. Each line needs a phone number; any other
 * non-email cell is taken as the name. Accepts "phone", "phone, name" or "name, phone".
 */
export function parseRecipients(text: string, defaultCc = DEFAULT_COUNTRY_CODE) {
  const valid: Recipient[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const cells = splitLine(line);
    let phone: string | null = null;
    let phoneIdx = -1;
    cells.forEach((c, idx) => {
      if (phone) return;
      const p = normalizePhone(c, defaultCc);
      if (p) {
        phone = p;
        phoneIdx = idx;
      }
    });

    if (!phone) {
      // Header row of a CSV (e.g. "name,phone") — ignore silently.
      if (i === 0 && cells.some((c) => /phone|mobile|number|whatsapp|name/i.test(c))) return;
      invalid.push(line);
      return;
    }
    if (seen.has(phone)) {
      duplicates.push(phone);
      return;
    }
    seen.add(phone);
    const name = cells.find((c, idx) => idx !== phoneIdx && c && !c.includes("@") && !/^\d[\d\s+().-]*$/.test(c)) ?? null;
    valid.push({ phone, name });
  });

  return { valid, invalid, duplicates };
}

/** Replace {name} / {first_name} / {phone} tokens with the recipient's values. */
export function fillTokens(value: string, r: Recipient, nameFallback = "there"): string {
  const name = r.name?.trim() || nameFallback;
  return value
    .replace(/\{first_name\}/gi, name.split(/\s+/)[0])
    .replace(/\{name\}/gi, name)
    .replace(/\{phone\}/gi, r.phone);
}
