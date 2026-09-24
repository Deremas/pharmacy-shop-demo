import { eatTodayYmd, parseBusinessDateInput } from "@/lib/eat-date";

export type BatchStock = {
  id: string;
  itemId: string;
  remainingQuantity: number;
  reservedQuantity?: number | null;
  buyingPrice?: unknown;
  expireDate?: Date | string | null;
  status?: string | null;
  createdAt?: Date | string | null;
  batchCode?: string | null;
};

export function calendarDay(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function businessToday(now = new Date()) {
  return parseBusinessDateInput(eatTodayYmd(now)).getTime();
}

export function isBatchExpired(expireDate?: Date | string | null, now = new Date()) {
  const day = calendarDay(expireDate);
  if (day == null) return false;
  return day < businessToday(now);
}

export function daysUntilExpiry(expireDate?: Date | string | null, now = new Date()) {
  const day = calendarDay(expireDate);
  if (day == null) return null;
  return Math.round((day - businessToday(now)) / 86_400_000);
}

export function expiryBand(expireDate?: Date | string | null, now = new Date()) {
  const days = daysUntilExpiry(expireDate, now);
  if (days == null) return "No expiry";
  if (days < 0) return "Expired";
  if (days <= 30) return "Critical";
  if (days <= 90) return "Near expiry";
  if (days <= 180) return "Warning";
  return "Normal";
}

export function availableBatchQuantity(batch: BatchStock) {
  const remaining = Number(batch.remainingQuantity || 0);
  const reserved = Number(batch.reservedQuantity || 0);
  return Math.max(0, remaining - reserved);
}

export function isSellableBatch(batch: BatchStock, now = new Date()) {
  const status = String(batch.status || "ACTIVE").toUpperCase();
  if (status !== "ACTIVE") return false;
  if (isBatchExpired(batch.expireDate, now)) return false;
  return availableBatchQuantity(batch) > 0;
}

export function sortFefo(batches: BatchStock[]) {
  return [...batches].sort((left, right) => {
    const leftExpiry = calendarDay(left.expireDate) ?? Number.POSITIVE_INFINITY;
    const rightExpiry = calendarDay(right.expireDate) ?? Number.POSITIVE_INFINITY;
    if (leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;
    const leftReceived = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightReceived = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return leftReceived - rightReceived;
  });
}

export function allocateFefo(batches: BatchStock[], quantity: number) {
  let remaining = quantity;
  const allocations: Array<{ batch: BatchStock; quantity: number }> = [];
  for (const batch of sortFefo(batches.filter((entry) => isSellableBatch(entry)))) {
    if (remaining <= Number.EPSILON) break;
    const available = availableBatchQuantity(batch);
    if (available <= 0) continue;
    const take = Math.min(remaining, available);
    allocations.push({ batch, quantity: take });
    remaining -= take;
  }
  return { allocations, shortfall: Math.max(0, remaining) };
}
