import type { Prisma } from "@/lib/generated/prisma/client";
import { cashAccountIdFor } from "@/lib/businesses";
import { resolveSaleCustomerId } from "@/lib/customer";
import { captureCredit } from "@/lib/finance/credit";
import { asMoney, moneyNumber } from "@/lib/money";
import { assertLocationAccess, createReference, type WriteActor } from "@/lib/actions/common";
import { runSerializableTransaction } from "@/lib/actions/transaction";
import { lowStockCrossings, stockTotalsForItems } from "@/lib/stock";
import { notifyBusiness, formatEtb, formatItemListLines, voidNotifyLowStock, voidNotifySaleDelete, tgTitle, escapeHtml } from "@/lib/telegram";
import { formatTelegramItemLabel } from "@/lib/item-display";
import { formatPaymentSummary, formatBankAccountLabel, salePaymentRows } from "@/lib/payment-display";
import { createSaleSchema, type CreateSaleInput } from "@/lib/validation/sale";
import { allocateFefo } from "@/lib/inventory/fefo";
import { assertWholeQuantity } from "@/lib/units";

function validatePaymentAllocation(sale: CreateSaleInput, total: Prisma.Decimal) {
  const cash = asMoney(sale.cashAmount);
  const bank = asMoney(sale.bankAmount);
  const credit = asMoney(sale.creditAmount);
  if (!cash.plus(bank).plus(credit).equals(total)) {
    throw new Error("Cash, bank, and credit allocations must equal the sale total.");
  }
  if (sale.paymentMethod === "CASH" && (!cash.equals(total) || !bank.isZero() || !credit.isZero())) {
    throw new Error("Cash sale payment allocation is invalid.");
  }
  if (sale.paymentMethod === "BANK" && (!bank.equals(total) || !cash.isZero() || !credit.isZero())) {
    throw new Error("Bank sale payment allocation is invalid.");
  }
  if (sale.paymentMethod === "CREDIT" && (!credit.equals(total) || !cash.isZero() || !bank.isZero())) {
    throw new Error("Credit sale payment allocation is invalid.");
  }
  return { cash, bank, credit };
}

export async function createSale(input: unknown, actor: WriteActor) {
  const parsed = createSaleSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Sale details are invalid.");
  }

  const data = parsed.data;
  assertLocationAccess(actor, data.locationId, "You do not have access to sell from the selected location.");

  const result = await runSerializableTransaction(async (tx) => {
    const location = await tx.location.findFirst({ where: { id: data.locationId, isActive: true }, select: { id: true } });
    if (!location) throw new Error("The selected sale location is unavailable.");

    const customerId = resolveSaleCustomerId(data.customerId);
    if (customerId) {
      const customer = await tx.customer.findFirst({ where: { id: customerId, isActive: true, locationId: data.locationId }, select: { id: true } });
      if (!customer) throw new Error("The selected customer is unavailable in this business.");
    }

    const lineValues = data.items.map((line) => {
      const gross = asMoney(line.price).mul(line.qty).toDecimalPlaces(2);
      const total = asMoney(line.total);
      if (total.gt(gross)) throw new Error("A sale line total cannot exceed its gross value.");
      return { line, gross, total, discount: gross.minus(total) };
    });
    const subTotal = lineValues.reduce((sum, entry) => sum.plus(entry.gross), asMoney(0));
    const totalAmount = lineValues.reduce((sum, entry) => sum.plus(entry.total), asMoney(0));
    const discount = subTotal.minus(totalAmount);

    if (!asMoney(data.subTotal).equals(subTotal) || !asMoney(data.totalAmount).equals(totalAmount) || !asMoney(data.discount).equals(discount)) {
      throw new Error("Sale totals changed or do not match the item lines. Please review and submit again.");
    }

  const payment = data.submitMode === "HOLD"
    ? { cash: asMoney(0), bank: asMoney(0), credit: asMoney(0) }
    : validatePaymentAllocation(data, totalAmount);
    let bankAccount: { id: string; accountType: string; displayName: string; bankName: string | null } | null = null;
    if (payment.bank.gt(0)) {
      bankAccount = await tx.bankAccount.findFirst({
        where: { id: data.bankAccountId || "", isActive: true, accountType: { in: ["BANK", "MOBILE"] }, locationId: data.locationId },
        select: { id: true, accountType: true, displayName: true, bankName: true },
      });
      if (!bankAccount) throw new Error("Select a valid bank account from this business.");
    }

    const itemIds = data.items.map((line) => line.itemId);
    const medicines = await tx.item.findMany({
      where: { id: { in: itemIds }, isActive: true, locationId: data.locationId },
      select: { id: true, name: true, requiresPrescription: true, unit: { select: { name: true } } },
    });
    if (medicines.length !== itemIds.length) throw new Error("One or more sale items are unavailable in this business.");
    for (const line of data.items) {
      const medicine = medicines.find((item) => item.id === line.itemId);
      assertWholeQuantity(line.qty, medicine?.unit?.name);
    }
    if (medicines.some((item) => item.requiresPrescription) && !String(data.prescriptionNumber || "").trim()) {
      throw new Error("This sale includes a prescription medicine. Enter the prescription number.");
    }

    if (payment.credit.gt(0) && customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: customerId },
        select: { allowCredit: true, creditLimit: true },
      });
      if (customer && customer.allowCredit === false) {
        throw new Error("This customer is not allowed to buy on credit.");
      }
      if (customer?.creditLimit != null) {
        const [creditSales, payments] = await Promise.all([
          tx.sale.aggregate({ where: { customerId, status: "COMPLETED" }, _sum: { creditAmount: true } }),
          tx.customerPayment.aggregate({ where: { customerId }, _sum: { amount: true } }),
        ]);
        const balance = Number(creditSales._sum.creditAmount || 0) - Number(payments._sum.amount || 0);
        const projected = balance + moneyNumber(payment.credit);
        if (projected - Number(customer.creditLimit) > 0.009) {
          throw new Error(`Credit limit exceeded. Limit ${Number(customer.creditLimit)}, projected debt ${projected.toFixed(2)}.`);
        }
      }
    }

    const stockBefore = await stockTotalsForItems(tx, data.locationId, itemIds);

    if (data.submitMode === "HOLD") {
      return holdSaleForCashier(tx, {
        data,
        actor,
        customerId,
        subTotal,
        discount,
        totalAmount,
        lineValues,
      });
    }

    const sale = await tx.sale.create({
      data: {
        locationId: data.locationId,
        customerId,
        voucherCode: createReference("S"),
        saleDate: data.saleDate,
        subTotal,
        discount,
        totalAmount,
        cashAmount: payment.cash,
        bankAmount: payment.bank,
        creditAmount: payment.credit,
        paymentStatus: payment.credit.gt(0) ? "PARTIAL" : "PAID",
        status: "COMPLETED",
        prescriptionNumber: data.prescriptionNumber || null,
        patientName: data.patientName || null,
        prescriberName: data.prescriberName || null,
        createdById: actor.id,
      },
    });

    for (const entry of lineValues) {
      const batches = await tx.inventoryBatch.findMany({
        where: { itemId: entry.line.itemId, locationId: data.locationId },
      });
      const plan = allocateFefo(batches, entry.line.qty);
      if (plan.shortfall > Number.EPSILON) {
        const usable = entry.line.qty - plan.shortfall;
        throw new Error(`Only ${usable} sellable unit(s) remain. Expired or reserved stock is not included.`);
      }
      const belowCost = plan.allocations.find((allocation) => asMoney(allocation.batch.buyingPrice).gt(asMoney(entry.line.price)));
      if (belowCost && !data.allowBelowCost) {
        throw new Error(`Selling below cost. Batch cost is ${asMoney(belowCost.batch.buyingPrice).toFixed(2)} and the selling price is ${asMoney(entry.line.price).toFixed(2)}. Manager approval is required.`);
      }

      let remainingLineTotal = entry.total;
      for (const allocation of plan.allocations) {
        const batch = allocation.batch;
        const quantity = allocation.quantity;
        const isLastAllocation = allocation === plan.allocations[plan.allocations.length - 1];
        const allocationTotal = isLastAllocation
          ? remainingLineTotal
          : entry.total.mul(quantity).div(entry.line.qty).toDecimalPlaces(2);
        const allocationGross = asMoney(entry.line.price).mul(quantity).toDecimalPlaces(2);
        const allocationDiscount = allocationGross.minus(allocationTotal);

        const claimed = await tx.inventoryBatch.updateMany({
          where: {
            id: batch.id,
            status: "ACTIVE",
            reservedQuantity: Number(batch.reservedQuantity || 0),
            remainingQuantity: { gte: Number(batch.reservedQuantity || 0) + quantity },
          },
          data: {
            remainingQuantity: { decrement: quantity },
            status: Number(batch.remainingQuantity) - quantity <= Number.EPSILON ? "DEPLETED" : "ACTIVE",
          },
        });
        if (claimed.count !== 1) throw new Error("Stock changed while this sale was being processed. Please retry.");

        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            itemId: entry.line.itemId,
            inventoryBatchId: batch.id,
            quantity,
            buyingPrice: asMoney(batch.buyingPrice),
            sellingPrice: asMoney(entry.line.price),
            discount: allocationDiscount,
            totalAmount: allocationTotal,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            itemId: entry.line.itemId,
            locationId: data.locationId,
            inventoryBatchId: batch.id,
            type: "SALE",
            quantity: -quantity,
            beforeQuantity: batch.remainingQuantity,
            afterQuantity: batch.remainingQuantity - quantity,
            referenceType: "SALE",
            referenceId: sale.id,
            createdById: actor.id,
          },
        });

        remainingLineTotal = remainingLineTotal.minus(allocationTotal);
      }
    }

    if (payment.credit.gt(0) && customerId) {
      await captureCredit(tx, {
        saleId: sale.id,
        customerId,
        amount: moneyNumber(payment.credit),
        locationId: data.locationId,
        createdById: actor.id,
      });
    }

    if (payment.bank.gt(0) && bankAccount) {
      await tx.bankAccount.update({ where: { id: bankAccount.id }, data: { currentBalance: { increment: payment.bank } } });
      await tx.bankTransaction.create({
        data: {
          bankAccountId: bankAccount.id,
          locationId: data.locationId,
          type: "SALE_PAYMENT",
          amount: payment.bank,
          referenceNo: sale.id,
          description: `Sale ${sale.voucherCode}`,
          transactionDate: sale.saleDate,
          createdById: actor.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        locationId: data.locationId,
        action: "CREATE",
        module: "Sales",
        tableName: "Sale",
        recordId: sale.id,
        newData: {
          voucherCode: sale.voucherCode,
          customerId,
          totalAmount: moneyNumber(totalAmount),
          cashAmount: moneyNumber(payment.cash),
          bankAmount: moneyNumber(payment.bank),
          creditAmount: moneyNumber(payment.credit),
          itemCount: data.items.length,
        },
      },
    });

    const catalog = await tx.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, code: true, locationId: true, lowStockAlert: true },
    });
    const byId = new Map(catalog.map((item) => [item.id, item]));
    const stockAfter = await stockTotalsForItems(tx, data.locationId, itemIds);
    const lowStock = lowStockCrossings({ items: catalog, before: stockBefore, after: stockAfter });

    return {
      id: sale.id,
      voucherCode: sale.voucherCode,
      locationId: data.locationId,
      totalAmount: moneyNumber(totalAmount),
      paymentMethod: data.paymentMethod,
      cashAmount: moneyNumber(payment.cash),
      bankAmount: moneyNumber(payment.bank),
      creditAmount: moneyNumber(payment.credit),
      bankAccountName: bankAccount ? formatBankAccountLabel(bankAccount) : null,
      lowStock,
      items: data.items.map((line) => {
        const item = byId.get(line.itemId);
        return {
          name: formatTelegramItemLabel(
            { name: item?.name, code: item?.code || undefined, locationId: item?.locationId || data.locationId },
            data.locationId,
          ),
          qty: line.qty,
        };
      }),
    };
  });

  if ("pending" in result && result.pending) {
    const telegram = await notifyBusiness(result.locationId, [
      tgTitle("🟡", "VOUCHER"),
      escapeHtml(String(result.voucherCode || "")),
      `Total: ${formatEtb(result.totalAmount)}`,
      "Waiting for cashier",
    ]);
    return { id: result.id, voucherCode: result.voucherCode, pending: true, telegram };
  }

  const paymentLine = formatPaymentSummary(
    result.paymentMethod,
    salePaymentRows({
      cashAmount: result.cashAmount,
      bankAmount: result.bankAmount,
      creditAmount: result.creditAmount,
    }),
    formatEtb,
  );
  const telegramLines = [
    tgTitle("🟢", "SALE"),
    escapeHtml(String(result.voucherCode || "")),
    `Total: ${formatEtb(result.totalAmount)}`,
    `Payment: ${escapeHtml(paymentLine)}`,
  ];
  if (result.bankAmount > 0 && result.bankAccountName) {
    telegramLines.push(`Bank: ${escapeHtml(result.bankAccountName)}`);
  }
  telegramLines.push(`Items: ${result.items.length}`, ...formatItemListLines(result.items));
  const telegram = await notifyBusiness(result.locationId, telegramLines);
  voidNotifyLowStock(result.locationId, result.lowStock);

  return {
    id: result.id,
    voucherCode: result.voucherCode,
    telegram,
  };
}

async function holdSaleForCashier(
  tx: any,
  input: {
    data: CreateSaleInput;
    actor: WriteActor;
    customerId?: string | null;
    subTotal: Prisma.Decimal;
    discount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    lineValues: Array<{ line: CreateSaleInput["items"][number]; total: Prisma.Decimal }>;
  },
) {
  const { data, actor, customerId, subTotal, discount, totalAmount, lineValues } = input;
  const voucherCode = createReference("RX");
  const pending = await tx.pendingSale.create({
    data: {
      locationId: data.locationId,
      voucherCode,
      customerId,
      saleDate: data.saleDate,
      subTotal,
      discount,
      totalAmount,
      lines: lineValues.map((entry) => ({
        itemId: entry.line.itemId,
        qty: entry.line.qty,
        price: entry.line.price,
        discount: entry.line.discount,
        total: moneyNumber(entry.total),
      })),
      prescriptionNumber: data.prescriptionNumber || null,
      patientName: data.patientName || null,
      prescriberName: data.prescriberName || null,
      status: "PENDING",
      createdById: actor.id,
    },
  });

  for (const entry of lineValues) {
    const batches = await tx.inventoryBatch.findMany({
      where: { itemId: entry.line.itemId, locationId: data.locationId },
    });
    const plan = allocateFefo(batches, entry.line.qty);
    if (plan.shortfall > Number.EPSILON) {
      throw new Error(`Only ${entry.line.qty - plan.shortfall} sellable unit(s) remain. Expired or reserved stock is not included.`);
    }
    const belowCost = plan.allocations.find((allocation) => asMoney(allocation.batch.buyingPrice).gt(asMoney(entry.line.price)));
    if (belowCost && !data.allowBelowCost) {
      throw new Error(`Selling below cost. Batch cost is ${asMoney(belowCost.batch.buyingPrice).toFixed(2)} and the selling price is ${asMoney(entry.line.price).toFixed(2)}. Manager approval is required.`);
    }
    for (const allocation of plan.allocations) {
      const batch = allocation.batch;
      const reserved = await tx.inventoryBatch.updateMany({
        where: {
          id: batch.id,
          status: "ACTIVE",
          reservedQuantity: Number(batch.reservedQuantity || 0),
          remainingQuantity: { gte: Number(batch.reservedQuantity || 0) + allocation.quantity },
        },
        data: { reservedQuantity: { increment: allocation.quantity } },
      });
      if (reserved.count !== 1) throw new Error("Stock changed while this voucher was being reserved. Please retry.");
      await tx.inventoryReservation.create({
        data: {
          pendingSaleId: pending.id,
          inventoryBatchId: batch.id,
          itemId: entry.line.itemId,
          locationId: data.locationId,
          quantity: allocation.quantity,
          unitCost: asMoney(batch.buyingPrice),
          status: "ACTIVE",
        },
      });
    }
  }

  return {
    pending: true as const,
    id: pending.id,
    voucherCode,
    locationId: data.locationId,
    totalAmount: moneyNumber(totalAmount),
    paymentMethod: "HOLD",
    cashAmount: 0,
    bankAmount: 0,
    creditAmount: 0,
    bankAccountName: "",
    lowStock: [],
    items: [],
  };
}

export async function cancelPendingSale(pendingId: string, actor: WriteActor) {
  return runSerializableTransaction(async (tx) => {
    const pending = await tx.pendingSale.findFirst({
      where: { id: pendingId, status: "PENDING" },
      include: { reservations: true },
    });
    if (!pending) throw new Error("That voucher is no longer waiting for the cashier.");
    assertLocationAccess(actor, pending.locationId, "You do not have access to this voucher.");
    for (const reservation of pending.reservations) {
      if (reservation.status !== "ACTIVE") continue;
      const released = await tx.inventoryBatch.updateMany({
        where: { id: reservation.inventoryBatchId, reservedQuantity: { gte: reservation.quantity } },
        data: { reservedQuantity: { decrement: reservation.quantity } },
      });
      if (released.count !== 1) throw new Error("Reserved stock could not be released.");
      await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: "RELEASED" } });
    }
    await tx.pendingSale.update({ where: { id: pending.id }, data: { status: "CANCELLED" } });
    return { id: pending.id };
  });
}

export async function completePendingSale(pendingId: string, paymentInput: unknown, actor: WriteActor) {
  const pending = await runSerializableTransaction(async (tx) => {
    const row = await tx.pendingSale.findFirst({
      where: { id: pendingId, status: "PENDING" },
      include: { reservations: true },
    });
    if (!row) throw new Error("That voucher is no longer waiting for the cashier.");
    assertLocationAccess(actor, row.locationId, "You do not have access to this voucher.");
    for (const reservation of row.reservations) {
      if (reservation.status !== "ACTIVE") continue;
      const released = await tx.inventoryBatch.updateMany({
        where: { id: reservation.inventoryBatchId, reservedQuantity: { gte: reservation.quantity } },
        data: { reservedQuantity: { decrement: reservation.quantity } },
      });
      if (released.count !== 1) throw new Error("Reserved stock could not be released.");
      await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: "CONSUMED" } });
    }
    await tx.pendingSale.update({ where: { id: row.id }, data: { status: "CHECKING_OUT" } });
    return row;
  });

  try {
    const lines = Array.isArray(pending.lines) ? pending.lines : [];
    const completed = await createSale({
      ...(typeof paymentInput === "object" && paymentInput ? paymentInput : {}),
      locationId: pending.locationId,
      customerId: pending.customerId,
      saleDate: pending.saleDate,
      subTotal: moneyNumber(pending.subTotal),
      discount: moneyNumber(pending.discount),
      totalAmount: moneyNumber(pending.totalAmount),
      submitMode: "COMPLETE",
      prescriptionNumber: pending.prescriptionNumber,
      patientName: pending.patientName,
      prescriberName: pending.prescriberName,
      items: lines,
    }, actor);
    await runSerializableTransaction(async (tx) => {
      await tx.pendingSale.update({
        where: { id: pending.id },
        data: { status: "COMPLETED", saleId: completed.id },
      });
    });
    return completed;
  } catch (error) {
    await runSerializableTransaction(async (tx) => {
      const reservations = await tx.inventoryReservation.findMany({ where: { pendingSaleId: pending.id, status: "CONSUMED" } });
      for (const reservation of reservations) {
        await tx.inventoryBatch.update({
          where: { id: reservation.inventoryBatchId },
          data: { reservedQuantity: { increment: reservation.quantity } },
        });
        await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: "ACTIVE" } });
      }
      await tx.pendingSale.update({ where: { id: pending.id }, data: { status: "PENDING" } });
    });
    throw error;
  }
}

async function reverseIncomingMoney(
  tx: any,
  input: {
    locationId: string;
    paymentMethod: string;
    bankAccountId?: string | null;
    amount: Prisma.Decimal;
    paymentId?: string | null;
    deleteBankTx: boolean;
  },
) {
  const amount = asMoney(input.amount);
  if (!amount.isPositive()) return;

  const method = String(input.paymentMethod || "").toUpperCase();
  if (method === "BANK") {
    const accountId = String(input.bankAccountId || "").trim();
    if (!accountId) return;
    await tx.bankAccount.update({
      where: { id: accountId },
      data: { currentBalance: { decrement: amount } },
    });
    if (input.paymentId) {
      if (input.deleteBankTx) {
        await tx.bankTransaction.deleteMany({
          where: { referenceNo: input.paymentId, type: "SALE_PAYMENT" },
        });
      } else {
        const txs = await tx.bankTransaction.findMany({
          where: { referenceNo: input.paymentId, type: "SALE_PAYMENT" },
        });
        let remaining = amount;
        for (const row of txs) {
          if (!remaining.isPositive()) break;
          const rowAmount = asMoney(row.amount);
          if (rowAmount.lte(remaining)) {
            await tx.bankTransaction.delete({ where: { id: row.id } });
            remaining = remaining.minus(rowAmount);
          } else {
            await tx.bankTransaction.update({
              where: { id: row.id },
              data: { amount: rowAmount.minus(remaining) },
            });
            remaining = asMoney(0);
          }
        }
      }
    }
    return;
  }

  if (method === "CASH") {
    const cashAccount =
      (await tx.bankAccount.findFirst({
        where: {
          id: cashAccountIdFor(input.locationId),
          accountType: "CASH",
          isActive: true,
          locationId: input.locationId,
        },
        select: { id: true },
      })) ||
      (await tx.bankAccount.findFirst({
        where: { accountType: "CASH", isActive: true, locationId: input.locationId },
        select: { id: true },
      }));
    if (cashAccount) {
      await tx.bankAccount.update({
        where: { id: cashAccount.id },
        data: { currentBalance: { decrement: amount } },
      });
    }
  }
}

export async function deleteSale(saleId: string, actor: WriteActor) {
  const id = String(saleId || "").trim();
  if (!id) throw new Error("Sale id is required.");

  const result = await runSerializableTransaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: {
        items: true,
        paymentAllocations: { select: { id: true, paymentId: true, amount: true } },
        customerPayments: { select: { id: true } },
      },
    });
    if (!sale) throw new Error("Sale not found.");

    assertLocationAccess(actor, sale.locationId, "You do not have access to delete sales in this business.");

    // Reverse related credit settlements (direct saleId + allocations) and their money.
    const paymentIds = new Set<string>([
      ...sale.paymentAllocations.map((row) => row.paymentId),
      ...sale.customerPayments.map((row) => row.id),
    ]);
    let removedCustomerPayments = 0;
    let reversedSettlementAmount = asMoney(0);

    for (const paymentId of paymentIds) {
      const payment = await tx.customerPayment.findUnique({
        where: { id: paymentId },
        include: { allocations: true },
      });
      if (!payment) continue;

      const allocationsHere = payment.allocations.filter((row) => row.saleId === sale.id);
      const amountHere = allocationsHere.reduce(
        (sum, row) => sum.plus(asMoney(row.amount)),
        asMoney(0),
      );
      const reverseAmount =
        amountHere.isPositive()
          ? amountHere
          : payment.saleId === sale.id
            ? asMoney(payment.amount)
            : asMoney(0);
      if (!reverseAmount.isPositive() && allocationsHere.length === 0 && payment.saleId !== sale.id) {
        continue;
      }

      if (allocationsHere.length) {
        await tx.customerPaymentAllocation.deleteMany({
          where: { id: { in: allocationsHere.map((row) => row.id) } },
        });
      }

      const remainingAllocations = payment.allocations.filter((row) => row.saleId !== sale.id);
      const deletePayment = remainingAllocations.length === 0;

      if (reverseAmount.isPositive()) {
        await reverseIncomingMoney(tx, {
          locationId: sale.locationId,
          paymentMethod: payment.paymentMethod,
          bankAccountId: payment.bankAccountId,
          amount: reverseAmount,
          paymentId: payment.id,
          deleteBankTx: deletePayment,
        });
        reversedSettlementAmount = reversedSettlementAmount.plus(reverseAmount);
      }

      if (deletePayment) {
        await tx.customerPayment.delete({ where: { id: payment.id } });
        removedCustomerPayments += 1;
      } else {
        const remainingAmount = remainingAllocations.reduce(
          (sum, row) => sum.plus(asMoney(row.amount)),
          asMoney(0),
        );
        await tx.customerPayment.update({
          where: { id: payment.id },
          data: {
            amount: remainingAmount,
            saleId: payment.saleId === sale.id ? null : payment.saleId,
          },
        });
      }
    }

    const saleReturns = await tx.saleReturn.findMany({
      where: { saleId: sale.id },
      include: { lines: true },
    });
    const returnedBySaleItem = new Map<string, number>();
    for (const entry of saleReturns) {
      const refunds = await tx.bankTransaction.findMany({
        where: { referenceNo: entry.id, type: "SALE_REFUND" },
      });
      for (const refund of refunds) {
        await tx.bankAccount.update({
          where: { id: refund.bankAccountId },
          data: { currentBalance: { increment: refund.amount } },
        });
      }
      await tx.bankTransaction.deleteMany({ where: { referenceNo: entry.id, type: "SALE_REFUND" } });
      await tx.inventoryMovement.deleteMany({ where: { referenceType: "SALE_RETURN", referenceId: entry.id } });
      for (const line of entry.lines) {
        returnedBySaleItem.set(line.saleItemId, (returnedBySaleItem.get(line.saleItemId) || 0) + line.quantity);
      }
    }
    if (saleReturns.length) {
      await tx.saleReturnLine.deleteMany({ where: { saleReturnId: { in: saleReturns.map((entry) => entry.id) } } });
      await tx.saleReturn.deleteMany({ where: { saleId: sale.id } });
    }

    const salePayments = await tx.bankTransaction.findMany({
      where: { referenceNo: sale.id, type: "SALE_PAYMENT" },
    });

    // Reverse bank inflow from this sale (cash sales have no bank row).
    for (const payment of salePayments) {
      const reversed = await tx.bankAccount.updateMany({
        where: { id: payment.bankAccountId, currentBalance: { gte: payment.amount } },
        data: { currentBalance: { decrement: payment.amount } },
      });
      if (reversed.count !== 1) {
        await tx.bankAccount.update({
          where: { id: payment.bankAccountId },
          data: { currentBalance: { decrement: payment.amount } },
        });
      }
    }

    for (const line of sale.items) {
      const restore = line.quantity - (returnedBySaleItem.get(line.id) || 0);
      if (restore <= Number.EPSILON) continue;
      const batch = await tx.inventoryBatch.findUnique({ where: { id: line.inventoryBatchId } });
      if (!batch) throw new Error("The original batch was not found.");
      const next = Number(batch.remainingQuantity) + restore;
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          remainingQuantity: { increment: restore },
          status: next > Number.EPSILON ? "ACTIVE" : batch.status,
        },
      });
    }

    await tx.inventoryMovement.deleteMany({
      where: { referenceType: "SALE", referenceId: sale.id },
    });

    await tx.bankTransaction.deleteMany({
      where: { referenceNo: sale.id, type: "SALE_PAYMENT" },
    });

    await tx.saleItem.deleteMany({ where: { saleId: sale.id } });
    await tx.sale.delete({ where: { id: sale.id } });

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        locationId: sale.locationId,
        action: "DELETE",
        module: "Sales",
        tableName: "Sale",
        recordId: sale.id,
        oldData: {
          voucherCode: sale.voucherCode,
          totalAmount: moneyNumber(sale.totalAmount),
          cashAmount: moneyNumber(sale.cashAmount),
          bankAmount: moneyNumber(sale.bankAmount),
          creditAmount: moneyNumber(sale.creditAmount),
          restoredItems: sale.items.map((line) => ({
            itemId: line.itemId,
            inventoryBatchId: line.inventoryBatchId,
            quantity: line.quantity,
          })),
          removedBankTransactions: salePayments.map((payment) => ({
            id: payment.id,
            bankAccountId: payment.bankAccountId,
            amount: moneyNumber(payment.amount),
          })),
          removedCustomerPayments,
          reversedSettlementAmount: moneyNumber(reversedSettlementAmount),
        },
      },
    });

    const catalog = await tx.item.findMany({
      where: { id: { in: sale.items.map((line) => line.itemId) } },
      select: { id: true, name: true, code: true, locationId: true },
    });
    const byId = new Map(catalog.map((item) => [item.id, item]));
    return {
      id: sale.id,
      locationId: sale.locationId,
      voucherCode: sale.voucherCode,
      totalAmount: moneyNumber(sale.totalAmount),
      telegramItems: sale.items.map((line) => {
        const item = byId.get(line.itemId);
        return {
          name: formatTelegramItemLabel(
            { name: item?.name, code: item?.code || undefined, locationId: item?.locationId || sale.locationId },
            sale.locationId,
          ),
          qty: line.quantity,
        };
      }),
      restoredQuantity: sale.items.reduce((sum, line) => sum + line.quantity, 0),
      restoredLines: sale.items.length,
      removedBankTransactions: salePayments.length,
      removedCustomerPayments,
      reversedSettlementAmount: moneyNumber(reversedSettlementAmount),
      creditCleared: moneyNumber(sale.creditAmount),
    };
  });

  voidNotifySaleDelete({
    locationId: result.locationId,
    voucherCode: result.voucherCode,
    totalAmount: result.totalAmount,
    items: result.telegramItems,
  });
  const { locationId: _locationId, totalAmount: _totalAmount, telegramItems: _telegramItems, ...response } = result;
  return response;
}
