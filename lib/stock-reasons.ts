export const DAMAGE_REASON_PRESETS = [
  "Broken / physical damage",
  "Expired / unsellable",
  "Water / moisture damage",
  "Defective / manufacturing fault",
  "Lost or missing (shrinkage)",
  "Customer return — unsellable",
  "Quality reject",
] as const;

export const ADJUSTMENT_REASON_PRESETS = [
  "Physical count correction",
  "Receiving entry mistake",
  "Sale entry mistake",
  "Transfer discrepancy",
  "Opening balance fix",
  "System / data correction",
] as const;

export const CUSTOM_REASON_VALUE = "__custom__";

export function resolveStockReason(preset: string, custom: string) {
  if (preset === CUSTOM_REASON_VALUE) return String(custom || "").trim();
  return String(preset || "").trim();
}
