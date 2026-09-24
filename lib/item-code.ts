const STRENGTH_PATTERN = /(\d+(?:\.\d+)?)(?=\s*(?:mg|mcg|g|ml|iu|%))/i;

export function suggestItemCode(input: {
  name?: string;
  category?: string;
  locationId?: string;
}) {
  const name = String(input.name || "").trim();
  const category = String(input.category || "").trim();
  const source = name || category;
  if (!source) return "";
  return medicineCode(source);
}

export function uniqueItemCode(base: string, existingCodes: Array<string | null | undefined>) {
  const seed = sanitizeCode(base) || "IT";
  const taken = new Set(
    existingCodes.map((code) => String(code || "").trim().toLowerCase()).filter(Boolean),
  );
  if (!taken.has(seed.toLowerCase())) return seed;
  for (let index = 2; index < 1000; index += 1) {
    const next = `${seed}-${index}`;
    if (!taken.has(next.toLowerCase())) return next;
  }
  return `${seed}-${Date.now().toString(36).toUpperCase()}`;
}

export function allocateItemCode(input: {
  requested?: string | null;
  name?: string;
  category?: string;
  locationId?: string;
  existingCodes?: Array<string | null | undefined>;
  allowRequestedDuplicate?: boolean;
}) {
  const existing = input.existingCodes || [];
  const requested = String(input.requested || "").trim();
  if (requested) {
    const taken = existing.map((code) => String(code || "").trim().toLowerCase());
    if (!input.allowRequestedDuplicate && taken.includes(requested.toLowerCase())) {
      return { code: requested, duplicate: true as const };
    }
    return { code: requested, duplicate: false as const };
  }
  const suggested = suggestItemCode(input) || genericCode(input.name || "IT");
  return { code: uniqueItemCode(suggested, existing), duplicate: false as const };
}

function medicineCode(name: string) {
  const strength = name.match(STRENGTH_PATTERN)?.[1];
  const label = name
    .replace(/\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|%)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = acronym(label || name) || "IT";
  return strength ? `${base}-${strength}` : base;
}

function genericCode(name: string) {
  return acronym(name) || "IT";
}

function acronym(text: string) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter((word) => /[A-Za-z]/.test(word));
  if (words.length >= 2) {
    return words
      .slice(0, 4)
      .map((word) => word.replace(/[^A-Za-z]/g, "")[0] || "")
      .join("")
      .toUpperCase();
  }
  const letters = String(words[0] || text || "").replace(/[^A-Za-z]/g, "");
  if (!letters) return "";
  return letters.slice(0, 3).toUpperCase();
}

function sanitizeCode(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, 24);
}
