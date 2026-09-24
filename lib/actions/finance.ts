import { assertLocationAccess, type WriteActor } from "@/lib/actions/common";
import { ensureExpenseCategory } from "@/lib/actions/business-defaults";
import { runSerializableTransaction } from "@/lib/actions/transaction";
import { settleCredit, getCustomerOutstandingCredit } from "@/lib/finance/credit";
import { asMoney, moneyNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { voidNotifyCreditPayment } from "@/lib/telegram";
import { formatBankAccountLabel } from "@/lib/payment-display";
import { cashTransferSchema, customerPaymentSchema, expenseCategorySchema, expenseSchema, supplierPaymentSchema } from "@/lib/validation/finance";

export async function createExpenseCategory(input: unknown, actor: WriteActor) {
  const parsed = expenseCategorySchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Category details are invalid.");
  const data = parsed.data;
  const locationId = data.locationId;
  assertLocationAccess(actor, locationId);

  const location = await prisma.location.findFirst({ where: { id: locationId, isActive: true }, select: { id: true } });
  if (!location) throw new Error("The selected business is unavailable.");

  const category = await ensureExpenseCategory(prisma, locationId, data.name);
  if (!category) throw new Error("Category name is required.");
  return { id: category.id, name: category.name };
}

export async function createExpense(input: unknown, actor: WriteActor) {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Expense details are invalid.");
  const data = parsed.data;
  assertLocationAccess(actor, data.locationId);

  return runSerializableTransaction(async (tx) => {
    const location = await tx.location.findFirst({ where: { id: data.locationId, isActive: true }, select: { id: true } });
    if (!location) throw new Error("The selected expense location is unavailable.");
    const amount = asMoney(data.amount);
    const description = data.description || data.category;

    let bankAccountId: string | null = null;
    if (data.paymentMethod === "BANK") {
      const account = await tx.bankAccount.findFirst({
        where: { id: data.bankAccountId || "", isActive: true, accountType: { in: ["BANK", "MOBILE"] }, locationId: data.locationId },
        select: { id: true, currentBalance: true },
      });
      if (!account) throw new Error("Select a valid bank account from this business.");
      if (account.currentBalance.lt(amount)) {
        throw new Error(`Insufficient bank balance. Available: ETB ${moneyNumber(account.currentBalance).toLocaleString()}.`);
      }
      const debited = await tx.bankAccount.updateMany({
        where: { id: account.id, isActive: true, currentBalance: { gte: amount } },
        data: { currentBalance: { decrement: amount } },
      });
      if (debited.count !== 1) throw new Error("Bank balance changed while recording the expense. Please retry.");
      bankAccountId = account.id;
    }

    await ensureExpenseCategory(tx, data.locationId, data.category);

    const expense = await tx.expense.create({
      data: {
        locationId: data.locationId,
        name: description,
        category: data.category,
        amount,
        paymentMethod: data.paymentMethod,
        bankAccountId,
        expenseDate: data.date,
        note: description,
        createdById: actor.id,
      },
    });

    if (bankAccountId) {
      await tx.bankTransaction.create({
        data: {
          bankAccountId,
          locationId: data.locationId,
          type: "WITHDRAW",
          amount,
          referenceNo: expense.id,
          description,
          transactionDate: data.date,
          createdById: actor.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        locationId: data.locationId,
        action: "CREATE",
        module: "Finance/Expenses",
        tableName: "Expense",
        recordId: expense.id,
        newData: { category: data.category, amount: moneyNumber(amount), paymentMethod: data.paymentMethod, bankAccountId },
      },
    });
    return { id: expense.id };
  });
}

export async function createCashTransfer(input: unknown, actor: WriteActor) {
  const parsed = cashTransferSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Cash transfer details are invalid.");
  const data = parsed.data;
  assertLocationAccess(actor, data.locationId);

  return runSerializableTransaction(async (tx) => {
    const [location, cashAccount, destination] = await Promise.all([
      tx.location.findFirst({ where: { id: data.locationId, isActive: true }, select: { id: true } }),
      tx.bankAccount.findFirst({ where: { accountType: "CASH", isActive: true, locationId: data.locationId }, select: { id: true } }),
      tx.bankAccount.findFirst({ where: { id: data.bankAccountId, accountType: { in: ["BANK", "MOBILE"] }, isActive: true, locationId: data.locationId }, select: { id: true } }),
    ]);
    if (!location) throw new Error("The selected transfer location is unavailable.");
    if (!cashAccount) throw new Error("The active cash account is unavailable.");
    if (!destination) throw new Error("Select a valid active destination bank account.");

    const amount = asMoney(data.amount);
    const [cashSales, purchases, cashExpenses, cashCustomerPayments, cashSupplierPayments, priorTransfers] = await Promise.all([
      tx.sale.aggregate({ where: { locationId: data.locationId }, _sum: { cashAmount: true } }),
      tx.purchase.findMany({ where: { locationId: data.locationId }, select: { id: true, paidAmount: true } }),
      tx.expense.aggregate({ where: { locationId: data.locationId, paymentMethod: "CASH" }, _sum: { amount: true } }),
      tx.customerPayment.aggregate({ where: { locationId: data.locationId, paymentMethod: "CASH" }, _sum: { amount: true } }),
      tx.supplierPayment.aggregate({ where: { locationId: data.locationId, paymentMethod: "CASH" }, _sum: { amount: true } }),
      tx.bankTransaction.aggregate({ where: { locationId: data.locationId, type: "CASH_TO_BANK" }, _sum: { amount: true } }),
    ]);
    const purchaseIds = purchases.map((purchase) => purchase.id);
    const purchaseBankPayments = purchaseIds.length > 0
      ? await tx.bankTransaction.aggregate({ where: { type: "SUPPLIER_PAYMENT", referenceNo: { in: purchaseIds } }, _sum: { amount: true } })
      : { _sum: { amount: null } };
    const paidAtPurchase = purchases.reduce((sum, purchase) => sum.plus(purchase.paidAmount), asMoney(0));
    const cashPurchasePayments = paidAtPurchase.minus(asMoney(purchaseBankPayments._sum.amount));
    const availableCash = asMoney(cashSales._sum.cashAmount)
      .plus(asMoney(cashCustomerPayments._sum.amount))
      .minus(cashPurchasePayments)
      .minus(asMoney(cashExpenses._sum.amount))
      .minus(asMoney(cashSupplierPayments._sum.amount))
      .minus(asMoney(priorTransfers._sum.amount));
    if (availableCash.lt(amount)) {
      throw new Error(`Insufficient cash balance. Available: ETB ${moneyNumber(availableCash).toLocaleString()}.`);
    }

    await tx.bankAccount.update({ where: { id: cashAccount.id }, data: { currentBalance: { decrement: amount } } });
    await tx.bankAccount.update({ where: { id: destination.id }, data: { currentBalance: { increment: amount } } });
    const transaction = await tx.bankTransaction.create({
      data: {
        bankAccountId: destination.id,
        locationId: data.locationId,
        type: "CASH_TO_BANK",
        amount,
        referenceNo: data.referenceNo || null,
        description: data.note || "Cash drawer deposit",
        transactionDate: data.date,
        createdById: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        locationId: data.locationId,
        action: "CREATE",
        module: "Finance/Cash Transfer",
        tableName: "BankTransaction",
        recordId: transaction.id,
        newData: { fromAccountId: cashAccount.id, toAccountId: destination.id, amount: moneyNumber(amount), referenceNo: data.referenceNo || null },
      },
    });
    return { id: transaction.id };
  });
}

export async function createSupplierPayment(input: unknown, actor: WriteActor) {
  const parsed = supplierPaymentSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Supplier payment details are invalid.");
  const data = parsed.data;
  assertLocationAccess(actor, data.locationId);

  return runSerializableTransaction(async (tx) => {
    const purchaseId = String(data.purchaseId || "").trim() || null;
    const [location, supplier, purchase, purchaseDebt, priorPayments] = await Promise.all([
      tx.location.findFirst({ where: { id: data.locationId, isActive: true }, select: { id: true } }),
      tx.supplier.findFirst({ where: { id: data.supplierId, isActive: true, locationId: data.locationId }, select: { id: true, name: true } }),
      purchaseId
        ? tx.purchase.findFirst({
            where: { id: purchaseId, supplierId: data.supplierId, locationId: data.locationId },
            select: { id: true },
          })
        : Promise.resolve(null),
      tx.purchase.aggregate({ where: { supplierId: data.supplierId }, _sum: { debtAmount: true } }),
      tx.supplierPayment.aggregate({ where: { supplierId: data.supplierId }, _sum: { amount: true } }),
    ]);
    if (!location) throw new Error("The selected payment location is unavailable.");
    if (!supplier) throw new Error("The selected supplier is unavailable.");
    if (purchaseId && !purchase) throw new Error("The selected purchase is unavailable for this supplier.");

    const amount = asMoney(data.amount);
    const outstanding = asMoney(purchaseDebt._sum.debtAmount).minus(asMoney(priorPayments._sum.amount));
    if (!outstanding.isPositive()) throw new Error("This supplier has no outstanding debt.");
    if (amount.gt(outstanding)) throw new Error(`Payment cannot exceed the outstanding debt of ETB ${moneyNumber(outstanding).toLocaleString()}.`);

    let bankAccountId: string | null = null;
    if (data.method === "BANK") {
      const account = await tx.bankAccount.findFirst({
        where: { id: data.bankAccountId || "", accountType: { in: ["BANK", "MOBILE"] }, isActive: true, locationId: data.locationId },
        select: { id: true, currentBalance: true },
      });
      if (!account) throw new Error("Select a valid bank account from this business.");
      if (account.currentBalance.lt(amount)) throw new Error(`Insufficient bank balance. Available: ETB ${moneyNumber(account.currentBalance).toLocaleString()}.`);
      const debited = await tx.bankAccount.updateMany({
        where: { id: account.id, isActive: true, currentBalance: { gte: amount } },
        data: { currentBalance: { decrement: amount } },
      });
      if (debited.count !== 1) throw new Error("Bank balance changed while recording the payment. Please retry.");
      bankAccountId = account.id;
    }

    const payment = await tx.supplierPayment.create({
      data: {
        supplierId: data.supplierId,
        purchaseId,
        locationId: data.locationId,
        amount,
        paymentMethod: data.method,
        bankAccountId,
        paymentDate: data.date,
        note: data.note || null,
        createdById: actor.id,
      },
    });
    if (bankAccountId) {
      await tx.bankTransaction.create({
        data: {
          bankAccountId,
          locationId: data.locationId,
          type: "SUPPLIER_PAYMENT",
          amount,
          referenceNo: payment.id,
          description: purchaseId
            ? `Supplier payment to ${supplier.name} (purchase ${purchaseId})`
            : `Supplier payment to ${supplier.name}`,
          transactionDate: data.date,
          createdById: actor.id,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        locationId: data.locationId,
        action: "CREATE",
        module: "Finance/Supplier Payments",
        tableName: "SupplierPayment",
        recordId: payment.id,
        newData: {
          supplierId: data.supplierId,
          purchaseId,
          amount: moneyNumber(amount),
          method: data.method,
          bankAccountId,
        },
      },
    });
    return { id: payment.id };
  });
}

export async function createCustomerPayment(input: unknown, actor: WriteActor) {
  const parsed = customerPaymentSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Customer payment details are invalid.");
  const data = parsed.data;
  const locationId = data.locationId || actor.locationId;
  if (!locationId) throw new Error("Select a payment location.");
  assertLocationAccess(actor, locationId);
  const method = data.method || data.paymentMethod;
  if (!method) throw new Error("Select a payment method.");

  const result = await runSerializableTransaction(async (tx) => {
    const location = await tx.location.findFirst({ where: { id: locationId, isActive: true }, select: { id: true } });
    if (!location) throw new Error("The selected payment location is unavailable.");
    const payment = await settleCredit(tx, {
      customerId: data.customerId,
      amount: moneyNumber(asMoney(data.amount)),
      paymentMethod: method,
      bankAccountId: data.bankAccountId,
      saleId: data.saleId || null,
      locationId,
      createdById: actor.id,
      date: data.date || new Date(),
      note: data.note || data.description || undefined,
    });
    const remainingBalance = await getCustomerOutstandingCredit(tx, data.customerId);
    const customer = await tx.customer.findFirst({
      where: { id: data.customerId },
      select: { name: true },
    });
    let saleLabel: string | null = null;
    if (data.saleId) {
      const sale = await tx.sale.findFirst({
        where: { id: data.saleId },
        select: { voucherCode: true },
      });
      saleLabel = sale?.voucherCode || null;
    }
    let bankAccountName: string | null = null;
    if (method === "BANK" && data.bankAccountId) {
      const bank = await tx.bankAccount.findFirst({
        where: { id: data.bankAccountId },
        select: { displayName: true, bankName: true },
      });
      bankAccountName = formatBankAccountLabel(bank) || null;
    }
    return {
      id: payment.id,
      remainingBalance,
      locationId,
      customerName: customer?.name || "Customer",
      amount: moneyNumber(asMoney(data.amount)),
      paymentMethod: method,
      saleLabel,
      bankAccountName,
    };
  });

  voidNotifyCreditPayment({
    locationId: result.locationId,
    customerName: result.customerName,
    amount: result.amount,
    paymentMethod: result.paymentMethod,
    remainingBalance: result.remainingBalance,
    saleLabel: result.saleLabel,
    bankAccountName: result.bankAccountName,
  });

  return { id: result.id, remainingBalance: result.remainingBalance };
}
