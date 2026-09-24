import { assertLocationAccess, createReference, type WriteActor } from "@/lib/actions/common";
import { runSerializableTransaction } from "@/lib/actions/transaction";
import { isExternalAccount } from "@/lib/finance/accounts";
import { asMoney, moneyNumber } from "@/lib/money";
import { assertWholeQuantity } from "@/lib/units";

async function restoreBatchQuantity(tx: any, batchId: string, quantity: number) {
  const batch = await tx.inventoryBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("The original batch was not found.");
  const next = Number(batch.remainingQuantity) + quantity;
  await tx.inventoryBatch.update({
    where: { id: batch.id },
    data: {
      remainingQuantity: { increment: quantity },
      status: next > Number.EPSILON ? "ACTIVE" : batch.status,
    },
  });
  return batch;
}

async function takeBatchQuantity(tx: any, batchId: string, quantity: number) {
  const batch = await tx.inventoryBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("The original batch was not found.");
  const available = Number(batch.remainingQuantity) - Number(batch.reservedQuantity || 0);
  if (quantity > available + Number.EPSILON) {
    throw new Error(`Only ${available} unreserved unit(s) can be returned from this batch.`);
  }
  const next = Number(batch.remainingQuantity) - quantity;
  const reduced = await tx.inventoryBatch.updateMany({
    where: {
      id: batch.id,
      reservedQuantity: Number(batch.reservedQuantity || 0),
      remainingQuantity: { gte: Number(batch.reservedQuantity || 0) + quantity },
    },
    data: {
      remainingQuantity: { decrement: quantity },
      status: next <= Number.EPSILON ? "DEPLETED" : "ACTIVE",
    },
  });
  if (reduced.count !== 1) throw new Error("Stock changed while this return was being saved.");
  return batch;
}

async function requireExternalAccount(tx: any, accountId: string, locationId: string) {
  const account = await tx.bankAccount.findFirst({
    where: { id: accountId, isActive: true, locationId },
  });
  if (!account || !isExternalAccount(account.accountType)) {
    throw new Error("Select a bank or mobile money account from this business.");
  }
  return account;
}

export async function voidSale(saleId: string, actor: WriteActor) {
  const id = String(saleId || "").trim();
  if (!id) throw new Error("Sale id is required.");

  return runSerializableTransaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: {
        items: true,
        saleReturns: { select: { id: true } },
        paymentAllocations: { select: { id: true, paymentId: true, amount: true } },
        customerPayments: { select: { id: true } },
      },
    });
    if (!sale) throw new Error("Sale not found.");
    if (sale.status === "VOIDED") throw new Error("This sale is already void.");
    if (sale.saleReturns.length > 0) {
      throw new Error("This sale already has a return. Delete it if the whole sale must be removed.");
    }
    assertLocationAccess(actor, sale.locationId, "You do not have access to void sales in this business.");

    const paymentIds = new Set<string>([
      ...sale.paymentAllocations.map((row) => row.paymentId),
      ...sale.customerPayments.map((row) => row.id),
    ]);
    for (const paymentId of paymentIds) {
      const payment = await tx.customerPayment.findUnique({
        where: { id: paymentId },
        include: { allocations: true },
      });
      if (!payment) continue;
      const allocationsHere = payment.allocations.filter((row) => row.saleId === sale.id);
      const amountHere = allocationsHere.reduce((sum, row) => sum.plus(asMoney(row.amount)), asMoney(0));
      const reverseAmount = amountHere.isPositive()
        ? amountHere
        : payment.saleId === sale.id
          ? asMoney(payment.amount)
          : asMoney(0);
      if (allocationsHere.length) {
        await tx.customerPaymentAllocation.deleteMany({ where: { id: { in: allocationsHere.map((row) => row.id) } } });
      }
      if (reverseAmount.isPositive() && payment.paymentMethod === "BANK" && payment.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: payment.bankAccountId },
          data: { currentBalance: { decrement: reverseAmount } },
        });
        await tx.bankTransaction.deleteMany({ where: { referenceNo: payment.id, type: "SALE_PAYMENT" } });
      }
      const remaining = payment.allocations.filter((row) => row.saleId !== sale.id);
      if (remaining.length === 0) {
        await tx.customerPayment.delete({ where: { id: payment.id } });
      } else {
        await tx.customerPayment.update({
          where: { id: payment.id },
          data: {
            amount: remaining.reduce((sum, row) => sum.plus(asMoney(row.amount)), asMoney(0)),
            saleId: payment.saleId === sale.id ? null : payment.saleId,
          },
        });
      }
    }

    const salePayments = await tx.bankTransaction.findMany({
      where: { referenceNo: sale.id, type: "SALE_PAYMENT" },
    });
    for (const payment of salePayments) {
      await tx.bankAccount.update({
        where: { id: payment.bankAccountId },
        data: { currentBalance: { decrement: payment.amount } },
      });
    }
    await tx.bankTransaction.deleteMany({ where: { referenceNo: sale.id, type: "SALE_PAYMENT" } });

    for (const line of sale.items) {
      const batch = await restoreBatchQuantity(tx, line.inventoryBatchId, line.quantity);
      await tx.inventoryMovement.create({
        data: {
          itemId: line.itemId,
          locationId: batch.locationId,
          inventoryBatchId: batch.id,
          type: "SALE_VOID",
          quantity: line.quantity,
          beforeQuantity: batch.remainingQuantity,
          afterQuantity: Number(batch.remainingQuantity) + line.quantity,
          referenceType: "SALE_VOID",
          referenceId: sale.id,
          note: "Sale void restored stock",
          createdById: actor.id,
        },
      });
    }

    await tx.sale.update({ where: { id: sale.id }, data: { status: "VOIDED" } });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        locationId: sale.locationId,
        action: "VOID",
        module: "Sales",
        tableName: "Sale",
        recordId: sale.id,
        oldData: { voucherCode: sale.voucherCode, totalAmount: moneyNumber(sale.totalAmount) },
      },
    });
    return { id: sale.id, voucherCode: sale.voucherCode };
  });
}

export async function createSaleReturn(input: {
  saleId?: string;
  reason?: string;
  refundMethod?: string;
  bankAccountId?: string;
  lines?: Array<{ saleItemId?: string; quantity?: number }>;
}, actor: WriteActor) {
  const saleId = String(input.saleId || "").trim();
  const reason = String(input.reason || "").trim();
  const refundMethod = String(input.refundMethod || "").toUpperCase();
  const requested = (input.lines || []).filter((line) => Number(line.quantity) > 0);
  if (!saleId || requested.length === 0) throw new Error("Choose a sale and at least one quantity to return.");
  if (reason.length < 3) throw new Error("A return reason is required.");
  if (!["CASH", "BANK", "CREDIT"].includes(refundMethod)) throw new Error("Choose a cash, bank, or credit refund.");

  return runSerializableTransaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        saleReturns: { include: { lines: true } },
        paymentAllocations: true,
      },
    });
    if (!sale) throw new Error("Sale not found.");
    if (sale.status === "VOIDED") throw new Error("A void sale cannot be returned.");
    assertLocationAccess(actor, sale.locationId, "You do not have access to return this sale.");

    const returned = new Map<string, number>();
    for (const entry of sale.saleReturns) {
      for (const line of entry.lines) {
        returned.set(line.saleItemId, (returned.get(line.saleItemId) || 0) + line.quantity);
      }
    }

    const prepared: Array<{ saleItem: typeof sale.items[number]; quantity: number; total: ReturnType<typeof asMoney> }> = [];
    for (const request of requested) {
      const saleItem = sale.items.find((line) => line.id === request.saleItemId);
      if (!saleItem) throw new Error("One of the return lines is not on this sale.");
      const quantity = Number(request.quantity);
      assertWholeQuantity(quantity, "units");
      const already = returned.get(saleItem.id) || 0;
      const left = saleItem.quantity - already;
      if (quantity > left + Number.EPSILON) throw new Error(`Only ${left} unit(s) can still be returned for that line.`);
      const unitNet = asMoney(saleItem.totalAmount).div(saleItem.quantity);
      prepared.push({ saleItem, quantity, total: unitNet.mul(quantity).toDecimalPlaces(2) });
    }
    const totalAmount = prepared.reduce((sum, line) => sum.plus(line.total), asMoney(0));

    if (refundMethod === "BANK") {
      await requireExternalAccount(tx, String(input.bankAccountId || ""), sale.locationId);
    }
    if (refundMethod === "CREDIT") {
      const paid = sale.paymentAllocations.reduce((sum, row) => sum.plus(asMoney(row.amount)), asMoney(0));
      const outstanding = asMoney(sale.creditAmount).minus(paid);
      if (totalAmount.gt(outstanding)) {
        throw new Error("Credit refund cannot exceed the unpaid balance. Refund the paid part in cash or to a bank or mobile account.");
      }
      await tx.sale.update({
        where: { id: sale.id },
        data: { creditAmount: { decrement: totalAmount } },
      });
    }

    const saleReturn = await tx.saleReturn.create({
      data: {
        saleId: sale.id,
        locationId: sale.locationId,
        returnNumber: createReference("SR"),
        refundMethod,
        bankAccountId: refundMethod === "BANK" ? input.bankAccountId : null,
        totalAmount,
        reason,
        createdById: actor.id,
        lines: {
          create: prepared.map((line) => ({
            saleItemId: line.saleItem.id,
            itemId: line.saleItem.itemId,
            inventoryBatchId: line.saleItem.inventoryBatchId,
            quantity: line.quantity,
            unitPrice: asMoney(line.saleItem.totalAmount).div(line.saleItem.quantity).toDecimalPlaces(2),
            totalAmount: line.total,
          })),
        },
      },
    });

    for (const line of prepared) {
      const batch = await restoreBatchQuantity(tx, line.saleItem.inventoryBatchId, line.quantity);
      await tx.inventoryMovement.create({
        data: {
          itemId: line.saleItem.itemId,
          locationId: batch.locationId,
          inventoryBatchId: batch.id,
          type: "SALE_RETURN",
          quantity: line.quantity,
          beforeQuantity: batch.remainingQuantity,
          afterQuantity: Number(batch.remainingQuantity) + line.quantity,
          referenceType: "SALE_RETURN",
          referenceId: saleReturn.id,
          note: reason,
          createdById: actor.id,
        },
      });
    }

    if (refundMethod === "BANK" && input.bankAccountId) {
      await tx.bankAccount.update({
        where: { id: input.bankAccountId },
        data: { currentBalance: { decrement: totalAmount } },
      });
      await tx.bankTransaction.create({
        data: {
          bankAccountId: input.bankAccountId,
          locationId: sale.locationId,
          type: "SALE_REFUND",
          amount: totalAmount,
          referenceNo: saleReturn.id,
          description: `Sale return ${saleReturn.returnNumber}`,
          createdById: actor.id,
        },
      });
    }

    const fullyReturned = sale.items.every((line) => {
      const extra = prepared.find((entry) => entry.saleItem.id === line.id)?.quantity || 0;
      return (returned.get(line.id) || 0) + extra >= line.quantity - Number.EPSILON;
    });
    await tx.sale.update({
      where: { id: sale.id },
      data: { status: fullyReturned ? "RETURNED" : "PARTIAL_RETURN" },
    });

    return { id: saleReturn.id, returnNumber: saleReturn.returnNumber, totalAmount: moneyNumber(totalAmount) };
  });
}

export async function createPurchaseReturn(input: {
  purchaseId?: string;
  reason?: string;
  refundMethod?: string;
  bankAccountId?: string;
  lines?: Array<{ purchaseItemId?: string; quantity?: number }>;
}, actor: WriteActor) {
  const purchaseId = String(input.purchaseId || "").trim();
  const reason = String(input.reason || "").trim();
  const refundMethod = String(input.refundMethod || "").toUpperCase();
  const requested = (input.lines || []).filter((line) => Number(line.quantity) > 0);
  if (!purchaseId || requested.length === 0) throw new Error("Choose a purchase and at least one quantity to return.");
  if (reason.length < 3) throw new Error("A return reason is required.");
  if (!["CASH", "BANK", "CREDIT"].includes(refundMethod)) throw new Error("Choose cash, bank, or supplier credit.");

  return runSerializableTransaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: true },
    });
    if (!purchase) throw new Error("Purchase not found.");
    assertLocationAccess(actor, purchase.locationId, "You do not have access to return this purchase.");

    const prepared: Array<{ purchaseItem: typeof purchase.items[number]; batchId: string; quantity: number; total: ReturnType<typeof asMoney> }> = [];
    for (const request of requested) {
      const purchaseItem = purchase.items.find((line) => line.id === request.purchaseItemId);
      if (!purchaseItem) throw new Error("One of the return lines is not on this purchase.");
      const quantity = Number(request.quantity);
      assertWholeQuantity(quantity);
      const batch = await tx.inventoryBatch.findFirst({
        where: {
          itemId: purchaseItem.itemId,
          batchCode: purchaseItem.batchCode,
          expireDate: purchaseItem.expireDate,
          buyingPrice: purchaseItem.buyingPrice,
          remainingQuantity: { gt: 0 },
        },
        orderBy: { createdAt: "asc" },
      });
      if (!batch) throw new Error("No remaining batch was found for that purchase line.");
      prepared.push({
        purchaseItem,
        batchId: batch.id,
        quantity,
        total: asMoney(purchaseItem.buyingPrice).mul(quantity).toDecimalPlaces(2),
      });
    }
    const totalAmount = prepared.reduce((sum, line) => sum.plus(line.total), asMoney(0));

    if (refundMethod === "BANK") {
      await requireExternalAccount(tx, String(input.bankAccountId || ""), purchase.locationId);
    }
    if (refundMethod === "CREDIT") {
      if (asMoney(purchase.debtAmount).lt(totalAmount)) {
        throw new Error("Supplier debt is lower than this return. Take the paid part back in cash or into a bank or mobile account.");
      }
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { debtAmount: { decrement: totalAmount } },
      });
    }

    const purchaseReturn = await tx.purchaseReturn.create({
      data: {
        purchaseId: purchase.id,
        locationId: purchase.locationId,
        returnNumber: createReference("PR"),
        refundMethod,
        bankAccountId: refundMethod === "BANK" ? input.bankAccountId : null,
        totalAmount,
        reason,
        createdById: actor.id,
        lines: {
          create: prepared.map((line) => ({
            purchaseItemId: line.purchaseItem.id,
            itemId: line.purchaseItem.itemId,
            inventoryBatchId: line.batchId,
            quantity: line.quantity,
            unitCost: asMoney(line.purchaseItem.buyingPrice),
            totalAmount: line.total,
          })),
        },
      },
    });

    for (const line of prepared) {
      const batch = await takeBatchQuantity(tx, line.batchId, line.quantity);
      await tx.inventoryMovement.create({
        data: {
          itemId: line.purchaseItem.itemId,
          locationId: batch.locationId,
          inventoryBatchId: batch.id,
          type: "PURCHASE_RETURN",
          quantity: -line.quantity,
          beforeQuantity: batch.remainingQuantity,
          afterQuantity: Number(batch.remainingQuantity) - line.quantity,
          referenceType: "PURCHASE_RETURN",
          referenceId: purchaseReturn.id,
          note: reason,
          createdById: actor.id,
        },
      });
    }

    if (refundMethod === "BANK" && input.bankAccountId) {
      await tx.bankAccount.update({
        where: { id: input.bankAccountId },
        data: { currentBalance: { increment: totalAmount } },
      });
      await tx.bankTransaction.create({
        data: {
          bankAccountId: input.bankAccountId,
          locationId: purchase.locationId,
          type: "PURCHASE_REFUND",
          amount: totalAmount,
          referenceNo: purchaseReturn.id,
          description: `Purchase return ${purchaseReturn.returnNumber}`,
          createdById: actor.id,
        },
      });
    }

    return { id: purchaseReturn.id, returnNumber: purchaseReturn.returnNumber, totalAmount: moneyNumber(totalAmount) };
  });
}
