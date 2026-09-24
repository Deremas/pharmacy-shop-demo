import { parseBusinessDateInput } from "@/lib/eat-date";
import { daysUntilExpiry, expiryBand, isBatchExpired, sortFefo, type BatchStock } from "@/lib/inventory/fefo";

export { expiryBand };

export type OpenBatch = BatchStock & {
  locationId?: string | null;
};

export function internalBatchCode(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INT-${stamp}-${tail}`;
}

export function isInternalBatchCode(code?: string | null) {
  return String(code || "").trim().toUpperCase().startsWith("INT-");
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
