const DIVISIBLE_UNITS = new Set(["kg", "kilogram", "liter", "litre", "meter", "metre"]);

export function isWholeUnit(unitName?: string | null) {
  const name = String(unitName || "").trim().toLowerCase();
  if (!name) return true;
  return !DIVISIBLE_UNITS.has(name);
}

export function wholeQuantity(qty: number, unitName?: string | null) {
  const value = Number(qty);
  if (!Number.isFinite(value)) return 0;
  if (!isWholeUnit(unitName)) return value;
  return Math.max(0, Math.round(value));
}

export function capWholeQuantity(qty: number, available: number, unitName?: string | null) {
  const requested = wholeQuantity(qty, unitName);
  const stock = Number(available);
  if (!Number.isFinite(stock)) return requested;
  if (!isWholeUnit(unitName)) return Math.min(requested, Math.max(0, stock));
  return Math.min(requested, Math.max(0, Math.floor(stock)));
}

export function assertWholeQuantity(qty: number, unitName?: string | null) {
  if (!isWholeUnit(unitName)) return;
  if (!Number.isInteger(qty)) {
    throw new Error(`Quantity must be a whole number of ${unitName || "units"}.`);
  }
}
