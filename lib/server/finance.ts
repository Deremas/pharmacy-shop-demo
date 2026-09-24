import { prisma } from "@/lib/prisma";
import { moneyNumber } from "@/lib/money";

export async function getGlobalAccounts() {
  return prisma.bankAccount.findMany({
    where: { isActive: true },
    orderBy: [
      { accountType: "asc" },
      { displayName: "asc" },
    ],
  });
}

export async function getFinanceLedger() {
  const [accounts, locations, sales, purchases, expenses, customerPayments, supplierPayments, bankTransactions] =
    await Promise.all([
      prisma.bankAccount.findMany({ where: { isActive: true } }),
      prisma.location.findMany({ where: { isActive: true } }),
      prisma.sale.findMany({ include: { customer: true, location: true } }),
      prisma.purchase.findMany({ include: { supplier: true, location: true } }),
      prisma.expense.findMany({ include: { location: true } }),
      prisma.customerPayment.findMany({ include: { customer: true, location: true } }),
      prisma.supplierPayment.findMany({ include: { supplier: true, location: true } }),
      prisma.bankTransaction.findMany({ include: { bankAccount: true, location: true } }),
    ]);

  const accountName = (id?: string | null) =>
    accounts.find((account) => account.id === id)?.displayName || "Main Cash Account";
  const cashAccount = accounts.find((account) => account.accountType === "CASH");

  const rows = [
    ...sales.flatMap((sale) => {
      const saleRows = [];
      if (sale.cashAmount.gt(0) && cashAccount) {
        saleRows.push({
          id: `${sale.id}-cash`,
          type: "INCOME" as const,
          category: "Sale",
          description: `Sale ${sale.voucherCode}`,
          amount: moneyNumber(sale.cashAmount),
          date: sale.saleDate,
          method: "CASH",
          accountId: cashAccount.id,
          accountName: cashAccount.displayName,
          locationId: sale.locationId,
          locationName: sale.location.name,
        });
      }
      if (sale.bankAmount.gt(0)) {
        const tx = bankTransactions.find((entry) => entry.referenceNo === sale.id && entry.type === "SALE_PAYMENT");
        saleRows.push({
          id: `${sale.id}-bank`,
          type: "INCOME" as const,
          category: "Sale",
          description: `Sale ${sale.voucherCode}`,
          amount: moneyNumber(sale.bankAmount),
          date: sale.saleDate,
          method: "BANK",
          accountId: tx?.bankAccountId || "",
          accountName: accountName(tx?.bankAccountId),
          locationId: sale.locationId,
          locationName: sale.location.name,
        });
      }
      return saleRows;
    }),
    ...purchases.flatMap((purchase) => {
      if (purchase.paidAmount.lte(0)) return [];
      const tx = bankTransactions.find((entry) => entry.referenceNo === purchase.id && entry.type === "SUPPLIER_PAYMENT");
      const isBank = Boolean(tx?.bankAccountId);
      return [{
        id: `${purchase.id}-paid`,
        type: "EXPENSE" as const,
        category: "Purchase",
        description: `Purchase ${purchase.invoiceNo || purchase.id}`,
        amount: moneyNumber(purchase.paidAmount),
        date: purchase.purchaseDate,
        method: isBank ? "BANK" : "CASH",
        accountId: tx?.bankAccountId || cashAccount?.id || "",
        accountName: isBank ? accountName(tx?.bankAccountId) : cashAccount?.displayName || "Main Cash Account",
        locationId: purchase.locationId,
        locationName: purchase.location.name,
      }];
    }),
    ...expenses.map((expense) => ({
      id: expense.id,
      type: "EXPENSE" as const,
      category: expense.category || "Expense",
      description: expense.name,
      amount: moneyNumber(expense.amount),
      date: expense.expenseDate,
      method: expense.paymentMethod,
      accountId: expense.bankAccountId || cashAccount?.id || "",
      accountName: expense.bankAccountId ? accountName(expense.bankAccountId) : cashAccount?.displayName || "Main Cash Account",
      locationId: expense.locationId,
      locationName: expense.location.name,
    })),
    ...customerPayments.map((payment) => ({
      id: payment.id,
      type: "INCOME" as const,
      category: "Customer Payment",
      description: payment.customer.name,
      amount: moneyNumber(payment.amount),
      date: payment.paymentDate,
      method: payment.paymentMethod,
      accountId: payment.bankAccountId || cashAccount?.id || "",
      accountName: payment.bankAccountId ? accountName(payment.bankAccountId) : cashAccount?.displayName || "Main Cash Account",
      locationId: payment.locationId,
      locationName: payment.location.name,
    })),
    ...supplierPayments.map((payment) => ({
      id: payment.id,
      type: "EXPENSE" as const,
      category: "Supplier Payment",
      description: payment.supplier.name,
      amount: moneyNumber(payment.amount),
      date: payment.paymentDate,
      method: payment.paymentMethod,
      accountId: payment.bankAccountId || cashAccount?.id || "",
      accountName: payment.bankAccountId ? accountName(payment.bankAccountId) : cashAccount?.displayName || "Main Cash Account",
      locationId: payment.locationId,
      locationName: payment.location.name,
    })),
  ];

  return {
    accounts,
    locations,
    transactions: rows.sort((a, b) => b.date.getTime() - a.date.getTime()),
  };
}
