export const EXTERNAL_ACCOUNT_TYPES = ["BANK", "MOBILE"] as const;

export function isExternalAccount(accountType?: string | null) {
  const type = String(accountType || "").toUpperCase();
  return type === "BANK" || type === "MOBILE";
}

export function externalAccountLabel(accountType?: string | null) {
  return String(accountType || "").toUpperCase() === "MOBILE" ? "Mobile money" : "Bank";
}
