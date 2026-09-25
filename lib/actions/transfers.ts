import { assertLocationAccess, type WriteActor } from "@/lib/actions/common";
import { runSerializableTransaction } from "@/lib/actions/transaction";
import { stockLocationIdsFor, tenantBusinessId } from "@/lib/businesses";
import { voidNotifyTransfer } from "@/lib/telegram";
import { formatTelegramItemLabel } from "@/lib/item-display";
import { transferSchema } from "@/lib/validation/transfer";

export async function createTransfer(input: unknown, actor: WriteActor) {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Transfer details are invalid.");
  const data = parsed.data;
  const fromLocationId = data.fromLocationId;
  const toLocationId = data.toLocationId;
  const tenantId = tenantBusinessId(fromLocationId);
  if (tenantBusinessId(toLocationId) !== tenantId) {
    throw new Error("Stock cannot be transferred between businesses.");
  }
  const bins = stockLocationIdsFor(tenantId);
  if (!bins.includes(fromLocationId) || !bins.includes(toLocationId)) {
    throw new Error("Transfers are only allowed between shop and store in the same business.");
  }
  assertLocationAccess(actor, tenantId, "You do not have access to transfer stock in this business.");

  const lines = data.items?.length
    ? data.items
    : data.itemId && data.quantity
      ? [{ itemId: data.itemId, quantity: data.quantity }]
      : [];

  const result = await runSerializableTransaction(async (tx) => {
    const [fromLocation, toLocation] = await Promise.all([
      tx.location.findFirst({ where: { id: fromLocationId, isActive: true }, select: { id: true } }),
      tx.location.findFirst({ where: { id: toLocationId, isActive: true }, select: { id: true } }),
    ]);
    if (!fromLocation || !toLocation) throw new Error("Counter or store is unavailable for this transfer.");

    const transfer = await tx.transfer.create({
      data: {
        sourceLocationId: fromLocationId,
        destinationLocationId: toLocationId,
        transferDate: data.date,
        status: "COMPLETED",
        note: data.note || null,
        createdById: actor.id,
      },
    });

    for (const line of lines) {
      const item = await tx.item.findFirst({
        where: { id: line.itemId, isActive: true, locationId: tenantId },
        select: { id: true },
      });
      if (!item) throw new Error("One or more transfer items are unavailable in this business.");

      const sourceBatches = await tx.inventoryBatch.findMany({
        where: { itemId: line.itemId, locationId: fromLocationId, remainingQuantity: { gt: 0 } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const available = sourceBatches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);
      if (available + Number.EPSILON < line.quantity) {
        throw new Error(`Only ${available} unit(s) remain at origin for one of the selected items.`);
      }

      let remainingQuantity = line.quantity;
      for (const batch of sourceBatches) {
        if (remainingQuantity <= Number.EPSILON) break;
        const quantity = Math.min(remainingQuantity, batch.remainingQuantity);
        const claimed = await tx.inventoryBatch.updateMany({
          where: { id: batch.id, remainingQuantity: { gte: quantity } },
          data: { remainingQuantity: { decrement: quantity } },
        });
        if (claimed.count !== 1) throw new Error("Stock changed while this transfer was being processed. Please retry.");

        const destBatch = await tx.inventoryBatch.create({
          data: {
            itemId: line.itemId,
            locationId: toLocationId,
            quantityIn: quantity,
            remainingQuantity: quantity,
            buyingPrice: batch.buyingPrice,
            sellingPrice: batch.sellingPrice,
            batchCode: batch.batchCode || transfer.id,
            expireDate: batch.expireDate,
          },
        });

        await tx.transferItem.create({
          data: {
            transferId: transfer.id,
            itemId: line.itemId,
            inventoryBatchId: destBatch.id,
            batchCode: destBatch.batchCode,
            expireDate: destBatch.expireDate,
            quantity,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            itemId: line.itemId,
            locationId: fromLocationId,
            inventoryBatchId: batch.id,
            type: "TRANSFER_OUT",
            quantity: -quantity,
            beforeQuantity: batch.remainingQuantity,
            afterQuantity: batch.remainingQuantity - quantity,
            referenceType: "TRANSFER",
            referenceId: transfer.id,
            createdById: actor.id,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            itemId: line.itemId,
            locationId: toLocationId,
            inventoryBatchId: destBatch.id,
            type: "TRANSFER_IN",
            quantity,
            beforeQuantity: 0,
            afterQuantity: quantity,
            referenceType: "TRANSFER",
            referenceId: transfer.id,
            createdById: actor.id,
          },
        });

        remainingQuantity -= quantity;
      }
    }

    const itemIds = lines.map((line) => line.itemId);
    const catalog = await tx.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, code: true, locationId: true },
    });
    const byId = new Map(catalog.map((item) => [item.id, item]));

    return {
      id: transfer.id,
      locationId: tenantId,
      fromLocationId,
      toLocationId,
      items: lines.map((line) => {
        const item = byId.get(line.itemId);
        return {
          name: formatTelegramItemLabel(
            { name: item?.name, code: item?.code || undefined, locationId: item?.locationId || tenantId },
            tenantId,
          ),
          qty: line.quantity,
        };
      }),
    };
  });

  voidNotifyTransfer({
    locationId: result.locationId,
    fromLocationId: result.fromLocationId,
    toLocationId: result.toLocationId,
    items: result.items,
  });

  return { id: result.id };
}
