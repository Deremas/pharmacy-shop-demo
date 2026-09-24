import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function moneyToCents(value: number | string | null | undefined) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

export function sumMoney(values: Array<number | string | null | undefined>) {
  return values.reduce<number>((totalCents, value) => totalCents + moneyToCents(value), 0) / 100;
}

export function subtractMoney(left: number, right: number) {
  return (moneyToCents(left) - moneyToCents(right)) / 100;
}

export function multiplyMoney(unitAmount: number, quantity: number) {
  return Math.round(Number(unitAmount || 0) * Number(quantity || 0) * 100) / 100;
}

export function parseCommaNumber(value: string): number {
  const parsed = parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatNumberWithCommas(value: number | string) {
  if (value === "" || value === undefined || value === null) return "";
  const num = typeof value === "string" ? parseCommaNumber(value) : value;
  if (!Number.isFinite(num)) return "";
  const negative = num < 0;
  const [intPart, decPart] = Math.abs(num).toString().split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formatted = decPart != null ? `${grouped}.${decPart}` : grouped;
  return negative ? `-${formatted}` : formatted;
}

/** Keep thousand separators while typing, including a trailing decimal point. */
export function formatNumericDraft(raw: string) {
  if (raw === "" || raw === "-") return raw;
  if (raw === "." || raw === "-.") return raw.startsWith("-") ? "-0." : "0.";
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const hasDot = unsigned.includes(".");
  const [intRaw = "", decRaw] = unsigned.split(".");
  const intDigits = intRaw.replace(/\D/g, "");
  const decDigits = (decRaw ?? "").replace(/\D/g, "");
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = hasDot ? `${grouped || "0"}.${decDigits}` : grouped;
  return negative ? `-${body}` : body;
}
