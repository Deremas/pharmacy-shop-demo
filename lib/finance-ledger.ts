export const CASH_ACCOUNT_ID = "CASH-GLOBAL";

export type LedgerTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  category: string;
  description: string;
  amount: number;
  date: Date;
  method: string;
  accountId: string;
  accountName: string;
  locationId: string;
  locationName?: string;
  sourceId: string;
};

export function movementSummary(transactions: LedgerTransaction[], storedCurrentBalance = 0) {
  const totalInflow = transactions
    .filter((tx) => tx.type === "INCOME" || tx.method === "BANK_IN")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalOutflow = transactions
    .filter((tx) => tx.type === "EXPENSE" || tx.method === "CASH_OUT")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const netMovement = totalInflow - totalOutflow;
  const openingBalance = Math.abs(storedCurrentBalance - netMovement) < 0.01
    ? 0
    : storedCurrentBalance - netMovement;

  return {
    openingBalance,
    totalInflow,
    totalOutflow,
    netMovement,
    availableBalance: openingBalance + netMovement,
  };
}

export function cashAccountForLocation(state: { bankAccounts: any[] }, locationId?: string) {
  const accounts = state.bankAccounts || [];
  if (locationId) {
    return accounts.find((account) => account.accountType === "CASH" && account.locationId === locationId) || null;
  }
  return accounts.find((account) => account.accountType === "CASH") || null;
}

export function buildLedgerTransactions(state: {
  sales: any[];
  purchases: any[];
  expenses: any[];
  customerPayments: any[];
  supplierPayments: any[];
  bankAccounts: any[];
  cashTransfers?: any[];
  items?: any[];
  products?: any[];
}): LedgerTransaction[] {
  const accountName = (accountId: string) =>
    state.bankAccounts.find((account) => account.id === accountId)?.displayName || "Unknown Account";
  const cashAccountId = (locationId?: string) => cashAccountForLocation(state, locationId)?.id || "";
  const saleDescription = (sale: any) => {
    const names = (sale.items || []).map((line: any) => {
      const product = (state.products || []).find((entry) => entry.id === line.itemId);
      const stockItem = (state.items || []).find((entry) => entry.id === line.itemId);
      return line.itemName || product?.name || stockItem?.name || line.itemId;
    });
    if (names.length === 0) return `Sale ${sale.id}`;
    if (names.length <= 2) return `Sale: ${names.join(", ")}`;
    return `Sale: ${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  };

  const rows: LedgerTransaction[] = [];

  state.sales.forEach((sale) => {
    if (sale.cashAmount > 0) {
      rows.push({
        id: `${sale.id}-cash`,
        type: "INCOME",
        category: "Sale",
        description: saleDescription(sale),
        amount: sale.cashAmount,
        date: new Date(sale.saleDate),
        method: "CASH",
        accountId: cashAccountId(sale.locationId),
        accountName: accountName(cashAccountId(sale.locationId)),
        locationId: sale.locationId,
        sourceId: sale.id,
      });
    }

    if (sale.bankAmount > 0 && sale.bankAccountId) {
      rows.push({
        id: `${sale.id}-bank`,
        type: "INCOME",
        category: "Sale",
        description: saleDescription(sale),
        amount: sale.bankAmount,
        date: new Date(sale.saleDate),
        method: "BANK",
        accountId: sale.bankAccountId,
        accountName: accountName(sale.bankAccountId),
        locationId: sale.locationId,
        sourceId: sale.id,
      });
    }
  });

  state.purchases.forEach((purchase) => {
    const cashAmount = purchase.cashAmount ?? (purchase.paymentMethod === "CASH" ? purchase.paidAmount : 0);
    const bankAmount = purchase.bankAmount ?? (purchase.paymentMethod === "BANK" ? purchase.paidAmount : 0);
    if (cashAmount > 0) {
      rows.push({
        id: `${purchase.id}-cash`,
        type: "EXPENSE",
        category: "Purchase",
        description: `Purchase payment ${purchase.id}`,
        amount: cashAmount,
        date: new Date(purchase.purchaseDate),
        method: "CASH",
        accountId: cashAccountId(purchase.locationId),
        accountName: accountName(cashAccountId(purchase.locationId)),
        locationId: purchase.locationId,
        sourceId: purchase.id,
      });
    }
    if (bankAmount > 0 && purchase.bankAccountId) {
      rows.push({
        id: `${purchase.id}-bank`,
        type: "EXPENSE",
        category: "Purchase",
        description: `Purchase bank payment ${purchase.id}`,
        amount: bankAmount,
        date: new Date(purchase.purchaseDate),
        method: "BANK",
        accountId: purchase.bankAccountId,
        accountName: accountName(purchase.bankAccountId),
        locationId: purchase.locationId,
        sourceId: purchase.id,
      });
    }
  });

  state.expenses.forEach((expense) => {
    const accountId = expense.paymentMethod === "CASH" ? cashAccountId(expense.locationId) : expense.bankAccountId;
    if (expense.amount > 0 && accountId) {
      rows.push({
        id: expense.id,
        type: "EXPENSE",
        category: expense.category,
        description: expense.description || `Expense ${expense.id}`,
        amount: expense.amount,
        date: new Date(expense.date),
        method: expense.paymentMethod,
        accountId,
        accountName: accountName(accountId),
        locationId: expense.locationId,
        sourceId: expense.id,
      });
    }
  });

  state.customerPayments.forEach((payment) => {
    const accountId = payment.method === "CASH" ? cashAccountId(payment.locationId) : payment.bankAccountId;
    if (payment.amount > 0 && accountId) {
      rows.push({
        id: payment.id,
        type: "INCOME",
        category: "Customer Payment",
        description: `Customer payment ${payment.id}`,
        amount: payment.amount,
        date: new Date(payment.date),
        method: payment.method,
        accountId,
        accountName: accountName(accountId),
        locationId: payment.locationId,
        sourceId: payment.id,
      });
    }
  });

  state.supplierPayments.forEach((payment) => {
    const accountId = payment.method === "CASH" ? cashAccountId(payment.locationId) : payment.bankAccountId;
    if (payment.amount > 0 && accountId) {
      rows.push({
        id: payment.id,
        type: "EXPENSE",
        category: "Supplier Payment",
        description: `Supplier payment ${payment.id}`,
        amount: payment.amount,
        date: new Date(payment.date),
        method: payment.method,
        accountId,
        accountName: accountName(accountId),
        locationId: payment.locationId,
        sourceId: payment.id,
      });
    }
  });

  (state.cashTransfers || []).forEach((transfer) => {
    rows.push({
      id: `${transfer.id}-cash-out`,
      type: "TRANSFER",
      category: "Cash Deposit",
      description: `Cash drawer to bank ${transfer.referenceNo || transfer.id}`,
      amount: transfer.amount,
      date: new Date(transfer.date),
      method: "CASH_OUT",
      accountId: cashAccountId(transfer.locationId),
      accountName: accountName(cashAccountId(transfer.locationId)),
      locationId: transfer.locationId,
      sourceId: transfer.id,
    });
    rows.push({
      id: `${transfer.id}-bank-in`,
      type: "TRANSFER",
      category: "Cash Deposit",
      description: `Bank deposit ${transfer.referenceNo || transfer.id}`,
      amount: transfer.amount,
      date: new Date(transfer.date),
      method: "BANK_IN",
      accountId: transfer.bankAccountId,
      accountName: accountName(transfer.bankAccountId),
      locationId: transfer.locationId,
      sourceId: transfer.id,
    });
  });

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}
