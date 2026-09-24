import { assertLocationAccess, createReference, type WriteActor } from "@/lib/actions/common";
import { runSerializableTransaction } from "@/lib/actions/transaction";
import { stockLocationIdsFor, tenantBusinessId } from "@/lib/businesses";
import { asMoney, moneyNumber } from "@/lib/money";
import { voidNotifyPurchase, voidNotifyPurchaseDelete } from "@/lib/telegram";
import { formatTelegramItemLabel } from "@/lib/item-display";
import { formatBankAccountLabel } from "@/lib/payment-display";
import { createPurchaseSchema } from "@/lib/validation/purchase";
import { assertWholeQuantity } from "@/lib/units";

export async function createPurchase(input: unknown, actor: WriteActor) {
  const parsed = createPurchaseSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Purchase details are invalid.");
  const data = parsed.data;
  const businessId = tenantBusinessId(data.locationId);
  const stockLocationId = String(data.stockLocationId || "").trim();
  if (!stockLocationIdsFor(businessId).includes(stockLocationId)) {
    throw new Error("Select Dispensary or Store to receive this stock.");
  }
  assertLocationAccess(actor, businessId, "You do not have access to purchase into the selected location.");

  const result = await runSerializableTransaction(async (tx) => {
    const [location, stockLocation, supplier] = await Promise.all([
      tx.location.findFirst({ where: { id: businessId, isActive: true }, select: { id: true } }),
      tx.location.findFirst({ where: { id: stockLocationId, isActive: true }, select: { id: true } }),
      tx.supplier.findFirst({ where: { id: data.supplierId, isActive: true, locationId: businessId }, select: { id: true } }),
    ]);
    if (!location) throw new Error("The selected purchase location is unavailable.");
    if (!stockLocation) throw new Error("Select Dispensary or Store to receive this stock.");
    if (!supplier) throw new Error("The selected supplier is unavailable.");

    const lines = data.items.map((line) => ({
      ...line,
      calculatedTotal: asMoney(line.unitCost).mul(line.qty).toDecimalPlaces(2),
    }));
    const totalAmount = lines.reduce((sum, line) => sum.plus(line.calculatedTotal), asMoney(0));
    const paidAmount = asMoney(data.paidAmount);
    const debtAmount = asMoney(data.debtAmount);
    const cashAmount = asMoney(data.cashAmount);
    const bankAmount = asMoney(data.bankAmount);

    if (!asMoney(data.totalAmount).equals(totalAmount) || lines.some((line) => !asMoney(line.total).equals(line.calculatedTotal))) {
      throw new Error("Purchase totals changed or do not match the item lines. Please review and submit again.");
    }
    if (!paidAmount.plus(debtAmount).equals(totalAmount)) throw new Error("Paid amount plus supplier debt must equal the purchase total.");
    if (!cashAmount.plus(bankAmount).equals(paidAmount)) throw new Error("Cash and bank allocations must equal the paid amount.");
    if (data.paymentMethod === "CASH" && (!cashAmount.equals(totalAmount) || !bankAmount.isZero() || !debtAmount.isZero())) throw new Error("Cash purchase payment allocation is invalid.");
    if (data.paymentMethod === "BANK" && (!bankAmount.equals(totalAmount) || !cashAmount.isZero() || !debtAmount.isZero())) throw new Error("Bank purchase payment allocation is invalid.");
    if (data.paymentMethod === "CREDIT" && (!debtAmount.equals(totalAmount) || !paidAmount.isZero())) throw new Error("Credit purchase payment allocation is invalid.");
    if (debtAmount.gt(0) && data.paymentMethod !== "CREDIT" && data.paymentMethod !== "MIXED") throw new Error("A purchase with supplier debt must use Credit or Mixed payment.");

    let bankAccount: { id: string; currentBalance: ReturnType<typeof asMoney>; displayName: string; bankName: string | null } | null = null;
    if (bankAmount.gt(0)) {
      bankAccount = await tx.bankAccount.findFirst({
        where: { id: data.bankAccountId || "", isActive: true, accountType: { in: ["BANK", "MOBILE"] }, locationId: businessId },
        select: { id: true, currentBalance: true, displayName: true, bankName: true },
      });
      if (!bankAccount) throw new Error("Select a valid bank account from this business.");
    }

    const itemIds = [...new Set(lines.map((line) => line.itemId))];
    const medicines = await tx.item.findMany({
      where: { id: { in: itemIds }, isActive: true, locationId: businessId },
      select: { id: true, unit: { select: { name: true } } },
    });
    if (medicines.length !== itemIds.length) throw new Error("One or more purchase items are unavailable in this business.");
    for (const line of lines) {
      const item = medicines.find((entry) => entry.id === line.itemId);
      assertWholeQuantity(line.qty, item?.unit?.name);
    }

    const purchase = await tx.purchase.create({
      data: {
        supplierId: data.supplierId,
        locationId: businessId,
        invoiceNo: createReference("P"),
        fsNumber: data.fsNumber || null,
        purchaseDate: data.purchaseDate,
        totalAmount,
        paidAmount,
        debtAmount,
        paymentStatus: debtAmount.equals(totalAmount) ? "UNPAID" : debtAmount.gt(0) ? "PARTIAL" : "PAID",
        createdById: actor.id,
      },
    });

    for (const line of lines) {
      const before = await tx.inventoryBatch.aggregate({
        where: { itemId: line.itemId, locationId: stockLocationId },
        _sum: { remainingQuantity: true },
      });
      const beforeQuantity = before._sum.remainingQuantity || 0;
      const purchaseItem = await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          itemId: line.itemId,
          quantity: line.qty,
          buyingPrice: asMoney(line.unitCost),
          sellingPrice: asMoney(line.sellingPrice),
          totalAmount: line.calculatedTotal,
          batchCode: line.batchCode,
          expireDate: line.expireDate,
        },
      });
      const existingBatch = await tx.inventoryBatch.findFirst({
        where: {
          itemId: line.itemId,
          locationId: stockLocationId,
          batchCode: line.batchCode,
          expireDate: line.expireDate,
          buyingPrice: asMoney(line.unitCost),
          status: "ACTIVE",
        },
      });
      const batch = existingBatch
        ? await tx.inventoryBatch.update({
            where: { id: existingBatch.id },
            data: {
              quantityIn: { increment: line.qty },
              remainingQuantity: { increment: line.qty },
              sellingPrice: asMoney(line.sellingPrice),
            },
          })
        : await tx.inventoryBatch.create({
            data: {
              itemId: line.itemId,
              locationId: stockLocationId,
              purchaseItemId: purchaseItem.id,
              quantityIn: line.qty,
              remainingQuantity: line.qty,
              buyingPrice: asMoney(line.unitCost),
              sellingPrice: asMoney(line.sellingPrice),
              batchCode: line.batchCode,
              expireDate: line.expireDate,
              status: "ACTIVE",
            },
          });
      if (asMoney(line.sellingPrice).gt(0)) {
        await tx.item.update({
          where: { id: line.itemId },
          data: { defaultSellingPrice: asMoney(line.sellingPrice) },
        });
      }
      await tx.inventoryMovement.create({
        data: {
          itemId: line.itemId,
          locationId: stockLocationId,
          inventoryBatchId: batch.id,
          type: "PURCHASE",
          quantity: line.qty,
          beforeQuantity,
          afterQuantity: beforeQuantity + line.qty,
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          createdById: actor.id,
        },
      });
    }

    if (bankAmount.gt(0) && bankAccount) {
      await tx.bankAccount.update({ where: { id: bankAccount.id }, data: { currentBalance: { decrement: bankAmount } } });
      await tx.bankTransaction.create({
        data: {
          bankAccountId: bankAccount.id,
          locationId: businessId,
          type: "SUPPLIER_PAYMENT",
          amount: bankAmount,
          referenceNo: purchase.id,
          description: `Purchase ${purchase.invoiceNo}`,
          transactionDate: purchase.purchaseDate,
          createdById: actor.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        locationId: businessId,
        action: "CREATE",
        module: "Purchases",
        tableName: "Purchase",
        recordId: purchase.id,
        newData: {
          invoiceNo: purchase.invoiceNo,
          supplierId: data.supplierId,
          totalAmount: moneyNumber(totalAmount),
          paidAmount: moneyNumber(paidAmount),
          debtAmount: moneyNumber(debtAmount),
          itemCount: lines.length,
        },
      },
    });

    const catalog = await tx.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, code: true, locationId: true },
    });
    const byId = new Map(catalog.map((item) => [item.id, item]));

    return {
      id: purchase.id,
      invoiceNo: purchase.invoiceNo || purchase.id,
      locationId: businessId,
      totalAmount: moneyNumber(totalAmount),
      stockLocationId,
      paymentMethod: data.paymentMethod,
      cashAmount: moneyNumber(cashAmount),
      bankAmount: moneyNumber(bankAmount),
      debtAmount: moneyNumber(debtAmount),
      paidAmount: moneyNumber(paidAmount),
      bankAccountName: bankAccount ? formatBankAccountLabel(bankAccount) : null,
      items: lines.map((line) => {
        const item = byId.get(line.itemId);
        return {
          name: formatTelegramItemLabel(
            { name: item?.name, code: item?.code || undefined, locationId: item?.locationId || businessId },
            businessId,
          ),
          qty: line.qty,
        };
      }),
    };
  });

  voidNotifyPurchase({
    locationId: result.locationId,
    invoiceNo: result.invoiceNo,
    totalAmount: result.totalAmount,
    stockLocationId: result.stockLocationId,
    paymentMethod: result.paymentMethod,
    cashAmount: result.cashAmount,
    bankAmount: result.bankAmount,
    debtAmount: result.debtAmount,
    paidAmount: result.paidAmount,
    bankAccountName: result.bankAccountName,
    items: result.items,
  });

  return { id: result.id, invoiceNo: result.invoiceNo };
}

export async function deletePurchase(purchaseId: string, actor: WriteActor) {
  const id = String(purchaseId || "").trim();
  if (!id) throw new Error("Purchase id is required.");

  const result = await runSerializableTransaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: { id },
      include: {
        items: true,
        supplierPayments: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            bankAccountId: true,
          },
        },
      },
    });
    if (!purchase) throw new Error("Purchase not found.");

    assertLocationAccess(actor, purchase.locationId, "You do not have access to delete purchases in this business.");

    const batches = await tx.inventoryBatch.findMany({
      where: { purchaseItemId: { in: purchase.items.map((line) => line.id) } },
      select: {
        id: true,
        purchaseItemId: true,
        quantityIn: true,
        remainingQuantity: true,
        itemId: true,
        locationId: true,
      },
    });

    // Blocked only when stock from those batches was already sold/transferred/adjusted.
    const batchIds = batches.map((batch) => batch.id);
    const stockAlreadyUsed = batches.some(
      (batch) => batch.remainingQuantity + Number.EPSILON < batch.quantityIn,
    );
    if (batchIds.length > 0) {
      const [saleUses, transferUses, laterMovements] = await Promise.all([
        tx.saleItem.count({ where: { inventoryBatchId: { in: batchIds } } }),
        tx.transferItem.count({ where: { inventoryBatchId: { in: batchIds } } }),
        tx.inventoryMovement.count({
          where: {
            inventoryBatchId: { in: batchIds },
            NOT: { AND: [{ referenceType: "PURCHASE" }, { referenceId: purchase.id }] },
          },
        }),
      ]);
      if (stockAlreadyUsed || saleUses > 0 || transferUses > 0 || laterMovements > 0) {
        throw new Error(
          "Cannot delete this purchase — some stock from it was already sold, transferred, or adjusted. Reverse those movements first.",
        );
      }
    }

    // Reverse + delete supplier payments linked to this purchase (cash/bank money).
    let removedSupplierPayments = 0;
    let reversedSupplierPaymentAmount = asMoney(0);
    for (const payment of purchase.supplierPayments) {
      const amount = asMoney(payment.amount);
      const method = String(payment.paymentMethod || "").toUpperCase();
      if (method === "BANK" && payment.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: payment.bankAccountId },
          data: { currentBalance: { increment: amount } },
        });
        await tx.bankTransaction.deleteMany({
          where: { referenceNo: payment.id, type: "SUPPLIER_PAYMENT" },
        });
      }
      await tx.supplierPayment.delete({ where: { id: payment.id } });
      removedSupplierPayments += 1;
      reversedSupplierPaymentAmount = reversedSupplierPaymentAmount.plus(amount);
    }

    const bankPayments = await tx.bankTransaction.findMany({
      where: { referenceNo: purchase.id, type: "SUPPLIER_PAYMENT" },
    });

    // Reverse bank outflow from this purchase (cash-only purchases have no bank row).
    for (const payment of bankPayments) {
      await tx.bankAccount.update({
        where: { id: payment.bankAccountId },
        data: { currentBalance: { increment: payment.amount } },
      });
    }

    await tx.inventoryMovement.deleteMany({
      where: { referenceType: "PURCHASE", referenceId: purchase.id },
    });

    // Remove unused batches created by this purchase (still fully remaining).
    if (batches.length) {
      await tx.inventoryBatch.deleteMany({
        where: { id: { in: batches.map((batch) => batch.id) } },
      });
    }

    await tx.bankTransaction.deleteMany({
      where: { referenceNo: purchase.id, type: "SUPPLIER_PAYMENT" },
    });

    await tx.purchaseItem.deleteMany({ where: { purchaseId: purchase.id } });
    await tx.purchase.delete({ where: { id: purchase.id } });

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        locationId: purchase.locationId,
        action: "DELETE",
        module: "Purchases",
        tableName: "Purchase",
        recordId: purchase.id,
        oldData: {
          invoiceNo: purchase.invoiceNo,
          totalAmount: moneyNumber(purchase.totalAmount),
          paidAmount: moneyNumber(purchase.paidAmount),
          debtAmount: moneyNumber(purchase.debtAmount),
          removedBatches: batches.map((batch) => ({
            id: batch.id,
            itemId: batch.itemId,
            locationId: batch.locationId,
            quantityIn: batch.quantityIn,
          })),
          removedBankTransactions: bankPayments.map((payment) => ({
            id: payment.id,
            bankAccountId: payment.bankAccountId,
            amount: moneyNumber(payment.amount),
          })),
          removedSupplierPayments,
          reversedSupplierPaymentAmount: moneyNumber(reversedSupplierPaymentAmount),
        },
      },
    });

    const catalog = await tx.item.findMany({
      where: { id: { in: purchase.items.map((line) => line.itemId) } },
      select: { id: true, name: true, code: true, locationId: true },
    });
    const byId = new Map(catalog.map((item) => [item.id, item]));
    return {
      id: purchase.id,
      locationId: purchase.locationId,
      invoiceNo: purchase.invoiceNo || purchase.id,
      totalAmount: moneyNumber(purchase.totalAmount),
      telegramItems: purchase.items.map((line) => {
        const item = byId.get(line.itemId);
        return {
          name: formatTelegramItemLabel(
            { name: item?.name, code: item?.code || undefined, locationId: item?.locationId || purchase.locationId },
            purchase.locationId,
          ),
          qty: line.quantity,
        };
      }),
      removedBatches: batches.length,
      removedBankTransactions: bankPayments.length,
      removedSupplierPayments,
      reversedSupplierPaymentAmount: moneyNumber(reversedSupplierPaymentAmount),
      debtCleared: moneyNumber(purchase.debtAmount),
    };
  });

  voidNotifyPurchaseDelete({
    locationId: result.locationId,
    invoiceNo: result.invoiceNo,
    totalAmount: result.totalAmount,
    items: result.telegramItems,
  });
  const { locationId: _locationId, totalAmount: _totalAmount, telegramItems: _telegramItems, ...response } = result;
  return response;
}
