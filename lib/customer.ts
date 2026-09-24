export const WALK_IN_CUSTOMER_ID = "__WALK_IN__";

export const WALK_IN_CUSTOMER_OPTION = {
  value: WALK_IN_CUSTOMER_ID,
  label: "Walk-in",
  meta: "No customer account",
} as const;

export function isWalkInCustomer(customerId: string | null | undefined) {
  return !customerId || customerId === WALK_IN_CUSTOMER_ID;
}

/** Maps UI walk-in / empty selection to null for persistence. */
export function resolveSaleCustomerId(customerId: string | null | undefined) {
  return isWalkInCustomer(customerId) ? null : customerId;
}
