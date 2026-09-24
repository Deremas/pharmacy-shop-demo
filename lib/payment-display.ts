/** Shared payment method labels and cash/bank/credit(debt) breakdowns. */

export type SalePaymentParts = {
  cashAmount?: number | null;
  bankAmount?: number | null;
  creditAmount?: number | null;
};

export type PurchasePaymentParts = {
  cashAmount?: number | null;
  bankAmount?: number | null;
  debtAmount?: number | null;
  paidAmount?: number | null;
};

function positive(value: number | null | undefined) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function resolveSalePaymentMethod(parts: SalePaymentParts) {
  const cash = positive(parts.cashAmount) > 0;
  const bank = positive(parts.bankAmount) > 0;
  const credit = positive(parts.creditAmount) > 0;
  const count = [cash, bank, credit].filter(Boolean).length;
  if (count > 1) return "MIXED";
  if (credit) return "CREDIT";
  if (bank) return "BANK";
  return "CASH";
}

export function resolvePurchasePaymentMethod(parts: PurchasePaymentParts) {
  const cash = positive(parts.cashAmount) > 0;
  const bank = positive(parts.bankAmount) > 0;
  const debt = positive(parts.debtAmount) > 0;
  const count = [cash, bank, debt].filter(Boolean).length;
  if (count > 1) return "MIXED";
  if (debt) return "CREDIT";
  if (bank) return "BANK";
  return "CASH";
}

export function salePaymentRows(parts: SalePaymentParts) {
  return [
    { label: "Cash", amount: positive(parts.cashAmount) },
    { label: "Bank", amount: positive(parts.bankAmount) },
    { label: "Credit", amount: positive(parts.creditAmount) },
  ].filter((row) => row.amount > 0);
}

export function purchasePaymentRows(parts: PurchasePaymentParts) {
  return [
    { label: "Cash", amount: positive(parts.cashAmount) },
    { label: "Bank", amount: positive(parts.bankAmount) },
    { label: "Debt", amount: positive(parts.debtAmount) },
  ].filter((row) => row.amount > 0);
}

/** e.g. "Cash ETB 10,000 · Bank ETB 50,000" */
export function formatPaymentPartsDetail(
  rows: Array<{ label: string; amount: number }>,
  formatMoney: (amount: number) => string,
) {
  if (!rows.length) return "";
  return rows.map((row) => `${row.label} ${formatMoney(row.amount)}`).join(" · ");
}

export function formatSalePaymentPartsDetail(
  parts: SalePaymentParts,
  formatMoney: (amount: number) => string,
) {
  return formatPaymentPartsDetail(salePaymentRows(parts), formatMoney);
}

export function formatPurchasePaymentPartsDetail(
  parts: PurchasePaymentParts,
  formatMoney: (amount: number) => string,
) {
  return formatPaymentPartsDetail(purchasePaymentRows(parts), formatMoney);
}

/** e.g. "MIXED — cash ETB 10,000 · bank ETB 50,000" */
export function formatPaymentSummary(
  method: string,
  rows: Array<{ label: string; amount: number }>,
  formatMoney: (amount: number) => string,
) {
  const methodLabel = String(method || "CASH").toUpperCase();
  const detail = formatPaymentPartsDetail(rows, formatMoney);
  if (!detail) return methodLabel;
  const compact = detail
    .replace(/\bCash\b/g, "cash")
    .replace(/\bBank\b/g, "bank")
    .replace(/\bCredit\b/g, "credit")
    .replace(/\bDebt\b/g, "debt");
  return `${methodLabel} — ${compact}`;
}

export function formatSalePaymentSummary(
  parts: SalePaymentParts & { paymentMethod?: string | null },
  formatMoney: (amount: number) => string,
) {
  const method = parts.paymentMethod || resolveSalePaymentMethod(parts);
  return formatPaymentSummary(method, salePaymentRows(parts), formatMoney);
}

export function formatPurchasePaymentSummary(
  parts: PurchasePaymentParts & { paymentMethod?: string | null },
  formatMoney: (amount: number) => string,
) {
  const method = parts.paymentMethod || resolvePurchasePaymentMethod(parts);
  return formatPaymentSummary(method, purchasePaymentRows(parts), formatMoney);
}

/** e.g. "BANK · Bole Pharmacy Bank" */
export function formatMethodWithBank(method?: string | null, bankLabel?: string | null) {
  const methodLabel = String(method || "CASH").toUpperCase();
  const bank = String(bankLabel || "").trim();
  if (bank && (methodLabel === "BANK" || methodLabel === "MIXED")) {
    return `${methodLabel} · ${bank}`;
  }
  return methodLabel;
}

export function formatBankAccountLabel(account?: {
  displayName?: string | null;
  bankName?: string | null;
} | null) {
  if (!account) return "";
  const display = String(account.displayName || "").trim();
  const bankName = String(account.bankName || "").trim();
  if (display && bankName && !display.toLowerCase().includes(bankName.toLowerCase())) {
    return `${display} (${bankName})`;
  }
  return display || bankName;
}
