export function cleanPackCode(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function sameCode(left: unknown, right: string) {
  const value = String(left ?? "").trim().toUpperCase();
  return Boolean(value) && value === right;
}

/** Match a scanned pack code to a medicine. The pack barcode wins over the shop SKU. */
export function findItemByScan(items: readonly any[], raw: unknown) {
  const code = String(raw ?? "").trim().toUpperCase();
  if (!code) return null;
  return items.find((item) => sameCode(item?.barcode, code)) || items.find((item) => sameCode(item?.code, code)) || null;
}
