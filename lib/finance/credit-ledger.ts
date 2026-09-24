export type CreditSaleInput = {
  id: string;
  customerId?: string | null;
  creditAmount?: number | null;
  saleDate?: string | Date | null;
  createdAt?: string | Date | null;
};

export type CreditPaymentInput = {
  id: string;
  customerId: string;
  saleId?: string | null;
  amount?: number | null;
};

export type CreditAllocationInput = {
  paymentId: string;
  saleId: string;
  amount?: number | null;
};

export type CreditSaleView = {
  saleId: string;
  customerId: string;
  saleDate: string | Date | null;
  originalCredit: number;
  paidAmount: number;
  outstandingAmount: number;
  status: "SETTLED" | "PARTIAL" | "PENDING";
};

function money(value: unknown) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export function creditStatus(originalCredit: number, paidAmount: number): CreditSaleView["status"] {
  const outstanding = Math.max(0, money(originalCredit) - money(paidAmount));
  if (outstanding === 0) return "SETTLED";
  if (money(paidAmount) > 0) return "PARTIAL";
  return "PENDING";
}

export function paidTowardSale(
  saleId: string,
  payments: CreditPaymentInput[] = [],
  allocations: CreditAllocationInput[] = [],
) {
  const allocated = allocations
    .filter((allocation) => allocation.saleId === saleId)
    .reduce((total, allocation) => total + money(allocation.amount), 0);

  const allocatedPaymentIds = new Set(
    allocations.map((allocation) => allocation.paymentId).filter(Boolean),
  );
  const linkedWithoutAllocation = payments
    .filter((payment) => payment.saleId === saleId && !allocatedPaymentIds.has(payment.id))
    .reduce((total, payment) => total + money(payment.amount), 0);

  return money(allocated + linkedWithoutAllocation);
}

export function describeCreditSale(
  sale: CreditSaleInput,
  payments: CreditPaymentInput[] = [],
  allocations: CreditAllocationInput[] = [],
): CreditSaleView | null {
  const originalCredit = money(sale.creditAmount);
  if (originalCredit <= 0 || !sale.customerId) return null;
  const paidAmount = Math.min(originalCredit, paidTowardSale(sale.id, payments, allocations));
  const outstandingAmount = money(Math.max(0, originalCredit - paidAmount));
  return {
    saleId: sale.id,
    customerId: sale.customerId,
    saleDate: sale.saleDate ?? null,
    originalCredit,
    paidAmount,
    outstandingAmount,
    status: creditStatus(originalCredit, paidAmount),
  };
}

export function listCreditSales(
  sales: CreditSaleInput[],
  payments: CreditPaymentInput[] = [],
  allocations: CreditAllocationInput[] = [],
) {
  return sales
    .map((sale) => describeCreditSale(sale, payments, allocations))
    .filter((sale): sale is CreditSaleView => Boolean(sale));
}

export function customerCreditBalance(
  customerId: string,
  sales: CreditSaleInput[],
  payments: CreditPaymentInput[],
) {
  const customerCredit = sales
    .filter((sale) => sale.customerId === customerId)
    .reduce((total, sale) => total + money(sale.creditAmount), 0);
  const customerPayments = payments
    .filter((payment) => payment.customerId === customerId)
    .reduce((total, payment) => total + money(payment.amount), 0);
  return Math.max(0, money(customerCredit - customerPayments));
}

export function unpaidCreditSales(
  customerId: string,
  sales: CreditSaleInput[],
  payments: CreditPaymentInput[] = [],
  allocations: CreditAllocationInput[] = [],
) {
  return listCreditSales(sales, payments, allocations)
    .filter((sale) => sale.customerId === customerId && sale.outstandingAmount > 0)
    .sort((left, right) => {
      const leftTime = new Date(left.saleDate || 0).getTime();
      const rightTime = new Date(right.saleDate || 0).getTime();
      return leftTime - rightTime;
    });
}

export function allocatePaymentFifo(
  unpaidSales: Array<{ saleId: string; outstandingAmount: number }>,
  amount: number,
) {
  const requested = money(amount);
  if (requested <= 0) return [] as Array<{ saleId: string; amount: number }>;

  let remaining = requested;
  const allocations: Array<{ saleId: string; amount: number }> = [];
  for (const sale of unpaidSales) {
    if (remaining <= 0) break;
    const outstanding = money(Math.max(0, sale.outstandingAmount));
    if (outstanding <= 0) continue;
    const allocation = money(Math.min(outstanding, remaining));
    if (allocation <= 0) continue;
    allocations.push({ saleId: sale.saleId, amount: allocation });
    remaining = money(remaining - allocation);
  }
  return allocations;
}
