import { Prisma } from "@/lib/generated/prisma/client";
import { asMoney, moneyNumber } from "@/lib/money";
import { cashAccountIdFor } from "@/lib/businesses";
import {
  allocatePaymentFifo,
  creditStatus,
  unpaidCreditSales,
} from "@/lib/finance/credit-ledger";

export interface CaptureCreditPayload {
  saleId: string;
  customerId: string;
  amount: number;
  locationId: string;
  createdById: string;
}

export interface SettleCreditPayload {
  customerId: string;
  amount: number;
  paymentMethod: "CASH" | "BANK";
  bankAccountId?: string | null;
  saleId?: string | null;
  locationId: string;
  createdById: string;
  date?: Date;
  note?: string;
}

function saleDateValue(sale: { saleDate?: Date | string | null; createdAt?: Date | string | null }) {
  return sale.saleDate || sale.createdAt || new Date(0);
}

export async function captureCredit(tx: any, payload: CaptureCreditPayload): Promise<void> {
  const { saleId, customerId, amount, locationId, createdById } = payload;
  if (amount <= 0) return;
  if (isNaN(amount) || !isFinite(amount)) {
    throw new Error("Invalid credit amount captured.");
  }

  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error(`Customer with ID ${customerId} not found.`);
  if (!customer.isActive) throw new Error(`Customer ${customer.name} is inactive.`);
  if (customer.locationId !== locationId) {
    throw new Error("This customer belongs to another business.");
  }

  await tx.auditLog.create({
    data: {
      userId: createdById,
      locationId,
      action: "CREATE",
      module: "Finance/Credit",
      tableName: "Sale",
      recordId: saleId,
      newData: {
        customerId,
        creditAmount: amount,
        message: `Captured outstanding credit of ${amount} for customer ${customer.name} on sale ${saleId}`,
      },
    },
  });
}

async function loadCustomerCreditState(tx: any, customerId: string) {
  const [sales, payments] = await Promise.all([
    tx.sale.findMany({
      where: { customerId, creditAmount: { gt: 0 } },
      select: { id: true, customerId: true, creditAmount: true, saleDate: true, createdAt: true, paymentStatus: true },
      orderBy: [{ saleDate: "asc" }, { createdAt: "asc" }],
    }),
    tx.customerPayment.findMany({
      where: { customerId },
      select: {
        id: true,
        customerId: true,
        saleId: true,
        amount: true,
        allocations: { select: { paymentId: true, saleId: true, amount: true } },
      },
    }),
  ]);

  const allocations = payments.flatMap((payment: any) =>
    (payment.allocations || []).map((allocation: any) => ({
      paymentId: allocation.paymentId || payment.id,
      saleId: allocation.saleId,
      amount: moneyNumber(allocation.amount),
    })),
  );
  const paymentRows = payments.map((payment: any) => ({
    id: payment.id,
    customerId: payment.customerId,
    saleId: payment.saleId,
    amount: moneyNumber(payment.amount),
  }));
  const saleRows = sales.map((sale: any) => ({
    id: sale.id,
    customerId: sale.customerId,
    creditAmount: moneyNumber(sale.creditAmount),
    saleDate: saleDateValue(sale),
    createdAt: sale.createdAt,
    paymentStatus: sale.paymentStatus,
  }));

  return {
    sales: saleRows,
    payments: paymentRows,
    allocations,
    unpaidSales: unpaidCreditSales(customerId, saleRows, paymentRows, allocations),
  };
}

export async function getCustomerOutstandingCredit(tx: any, customerId: string): Promise<number> {
  const state = await loadCustomerCreditState(tx, customerId);
  return moneyNumber(
    state.unpaidSales.reduce((total, sale) => total + sale.outstandingAmount, 0),
  );
}

async function applyAccountCredit(
  tx: any,
  payload: {
    paymentId: string;
    customerName: string;
    amount: Prisma.Decimal;
    paymentMethod: "CASH" | "BANK";
    bankAccountId?: string | null;
    locationId: string;
    createdById: string;
    date: Date;
    note?: string;
  },
) {
  const { paymentId, customerName, amount, paymentMethod, locationId, createdById, date, note } = payload;

  if (paymentMethod === "BANK") {
    if (!payload.bankAccountId) {
      throw new Error("Bank account ID is required for BANK payment method.");
    }
    const bankAccount = await tx.bankAccount.findFirst({
      where: {
        id: payload.bankAccountId,
        isActive: true,
        accountType: { in: ["BANK", "MOBILE"] },
        locationId,
      },
    });
    if (!bankAccount) {
      throw new Error("Select a valid bank account from this business.");
    }
    await tx.bankAccount.update({
      where: { id: bankAccount.id },
      data: { currentBalance: { increment: amount } },
    });
    await tx.bankTransaction.create({
      data: {
        bankAccountId: bankAccount.id,
        locationId,
        type: "SALE_PAYMENT",
        amount,
        referenceNo: paymentId,
        description: note || `Credit settlement payment from ${customerName}`,
        transactionDate: date,
        createdById,
      },
    });
    return bankAccount.id as string;
  }

  const cashAccount =
    (await tx.bankAccount.findFirst({
      where: { id: cashAccountIdFor(locationId), accountType: "CASH", isActive: true, locationId },
    })) ||
    (await tx.bankAccount.findFirst({
      where: { accountType: "CASH", isActive: true, locationId },
    }));
  if (!cashAccount) {
    throw new Error("The cash account for this business is unavailable.");
  }
  await tx.bankAccount.update({
    where: { id: cashAccount.id },
    data: { currentBalance: { increment: amount } },
  });
  return cashAccount.id as string;
}

async function refreshSalePaymentStatus(tx: any, saleId: string, originalCredit: number, paidAmount: number) {
  const outstanding = Math.max(0, moneyNumber(asMoney(originalCredit).minus(asMoney(paidAmount))));
  const status = creditStatus(originalCredit, paidAmount);
  await tx.sale.update({
    where: { id: saleId },
    data: {
      paymentStatus: outstanding === 0 ? "PAID" : status === "PARTIAL" ? "PARTIAL" : "CREDIT",
    },
  });
}

export async function settleCredit(tx: any, payload: SettleCreditPayload): Promise<any> {
  const {
    customerId,
    amount,
    paymentMethod,
    bankAccountId,
    saleId,
    locationId,
    createdById,
    date,
    note,
  } = payload;

  if (amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  if (isNaN(amount) || !isFinite(amount)) {
    throw new Error("Invalid settlement amount.");
  }

  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error(`Customer with ID ${customerId} not found.`);
  if (!customer.isActive) throw new Error(`Customer ${customer.name} is inactive.`);
  if (customer.locationId !== locationId) {
    throw new Error("This customer belongs to another business.");
  }

  const state = await loadCustomerCreditState(tx, customerId);
  const paymentDate = date || new Date();
  const requested = asMoney(amount);
  let allocations: Array<{ saleId: string; amount: number }> = [];

  if (saleId) {
    const selectedSale = state.unpaidSales.find((sale) => sale.saleId === saleId);
    if (!selectedSale) {
      throw new Error("Select an unpaid credit sale for this customer.");
    }
    if (requested.gt(asMoney(selectedSale.outstandingAmount))) {
      throw new Error("Amount cannot exceed this sale's outstanding balance.");
    }
    allocations = [{ saleId: selectedSale.saleId, amount: moneyNumber(requested) }];
  } else {
    const outstanding = asMoney(
      state.unpaidSales.reduce((total, sale) => total + sale.outstandingAmount, 0),
    );
    if (!outstanding.isPositive()) {
      throw new Error(`Customer ${customer.name} has no outstanding credit balance to settle.`);
    }
    if (requested.gt(outstanding)) {
      throw new Error(
        `Settlement amount cannot exceed the current outstanding credit of ETB ${moneyNumber(outstanding).toLocaleString()}.`,
      );
    }
    allocations = allocatePaymentFifo(state.unpaidSales, moneyNumber(requested));
    const allocatedTotal = asMoney(allocations.reduce((total, allocation) => total + allocation.amount, 0));
    if (allocatedTotal.lt(requested)) {
      throw new Error("Amount cannot exceed the selected outstanding balance.");
    }
  }

  if (allocations.length === 0) {
    throw new Error("There is no outstanding credit to apply this payment to.");
  }

  const payment = await tx.customerPayment.create({
    data: {
      customerId,
      saleId: saleId || null,
      locationId,
      amount: requested,
      paymentMethod,
      bankAccountId: paymentMethod === "BANK" ? bankAccountId || null : null,
      paymentDate,
      createdById,
      note: note || (saleId ? "Credit settlement for selected sale" : "Credit settlement payment"),
    },
  });

  await tx.customerPaymentAllocation.createMany({
    data: allocations.map((allocation) => ({
      paymentId: payment.id,
      saleId: allocation.saleId,
      amount: asMoney(allocation.amount),
    })),
  });

  await applyAccountCredit(tx, {
    paymentId: payment.id,
    customerName: customer.name,
    amount: requested,
    paymentMethod,
    bankAccountId,
    locationId,
    createdById,
    date: paymentDate,
    note,
  });

  for (const allocation of allocations) {
    const sale = state.unpaidSales.find((entry) => entry.saleId === allocation.saleId);
    if (!sale) continue;
    await refreshSalePaymentStatus(
      tx,
      allocation.saleId,
      sale.originalCredit,
      sale.paidAmount + allocation.amount,
    );
  }

  const outstandingBefore = state.unpaidSales.reduce((total, sale) => total + sale.outstandingAmount, 0);
  await tx.auditLog.create({
    data: {
      userId: createdById,
      locationId,
      action: "CREATE",
      module: "Finance/Credit",
      tableName: "CustomerPayment",
      recordId: payment.id,
      newData: {
        customerId,
        saleId: saleId || null,
        amount: moneyNumber(requested),
        paymentMethod,
        bankAccountId: paymentMethod === "BANK" ? bankAccountId || null : null,
        allocations,
        outstandingBefore,
        outstandingAfter: moneyNumber(asMoney(outstandingBefore).minus(requested)),
      },
    },
  });

  return payment;
}
