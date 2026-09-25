import { parseBusinessDateInput } from "@/lib/eat-date";
import { daysUntilExpiry, expiryBand, isBatchExpired, sortFefo, type BatchStock } from "@/lib/inventory/fefo";

export { expiryBand };

export type OpenBatch = BatchStock & {
  locationId?: string | null;
};

const INTERNAL_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function internalStamp(now: Date) {
  const year = String(now.getFullYear()).slice(2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function randomTail(length: number) {
  let tail = "";
  for (let index = 0; index < length; index += 1) {
    tail += INTERNAL_ALPHABET[Math.floor(Math.random() * INTERNAL_ALPHABET.length)];
  }
  return tail;
}

/** Short shop lot, for example I250925K7. Skips codes already in use. */
export function internalBatchCode(taken: Iterable<string | null | undefined> = [], now = new Date()) {
  const used = new Set(
    [...taken].map((code) => String(code || "").trim().toUpperCase()).filter(Boolean),
  );
  const stamp = internalStamp(now);
  for (let length = 2; length <= 3; length += 1) {
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const code = `I${stamp}${randomTail(length)}`;
      if (!used.has(code)) return code;
    }
  }
  const fallback = `I${stamp}${Date.now().toString(36).slice(-4).toUpperCase()}`;
  return used.has(fallback) ? `${fallback}${randomTail(1)}` : fallback;
}

export function isInternalBatchCode(code?: string | null) {
  const value = String(code || "").trim().toUpperCase();
  return value.startsWith("INT-") || /^I\d{6}[0-9A-Z]{2,5}$/.test(value);
}

export function toDateInputValue(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function formatExpiryDay(value?: Date | string | null) {
  if (!value) return "No expiry";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiry";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function expiryTone(value?: Date | string | null) {
  const band = expiryBand(value);
  if (band === "Expired" || band === "Critical") return "text-rose-600";
  if (band === "Near expiry" || band === "Warning") return "text-amber-600";
  if (band === "No expiry") return "text-slate-400";
  return "text-slate-700 dark:text-zinc-200";
}

export function openBatches(batches: OpenBatch[], itemId: string, locationId?: string): OpenBatch[] {
  return sortFefo(
    batches.filter((batch) => {
      if (batch.itemId !== itemId) return false;
      if (locationId && batch.locationId !== locationId) return false;
      if (String(batch.status || "ACTIVE").toUpperCase() !== "ACTIVE") return false;
      return Number(batch.remainingQuantity || 0) > 0;
    }),
  ) as OpenBatch[];
}

export function soonestBatch(batches: OpenBatch[]) {
  const open = sortFefo(batches.filter((batch) => Number(batch.remainingQuantity || 0) > 0));
  return open.find((batch) => batch.expireDate) || open[0] || null;
}

export function expiryInputWarning(value?: string | null) {
  if (!value) return "";
  const days = daysUntilExpiry(value);
  if (days == null) return "";
  if (days <= 0) return "This date is already past.";
  if (days <= 90) return `Expires in ${days} day${days === 1 ? "" : "s"}.`;
  return "";
}

export function parseReceiptBatch(
  input: { batchCode?: string | null; expireDate?: string | null; noExpiry?: boolean },
  now = new Date(),
) {
  const batchCode = String(input.batchCode || "").trim();
  if (!batchCode) {
    throw new Error("Enter the batch number from the pack, or use an internal lot.");
  }
  if (input.noExpiry || input.expireDate == null || input.expireDate === "") {
    if (!input.noExpiry) {
      throw new Error("Enter the expiry date, or mark this pack as having no expiry.");
    }
    return { batchCode, expireDate: null as Date | null };
  }
  const expireDate = parseBusinessDateInput(String(input.expireDate).slice(0, 10));
  if (Number.isNaN(expireDate.getTime()) || isBatchExpired(expireDate, now) || (daysUntilExpiry(expireDate, now) ?? 1) <= 0) {
    throw new Error("Expiry must be after today.");
  }
  return { batchCode, expireDate };
}
