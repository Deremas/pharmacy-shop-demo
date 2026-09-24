import { assertLocationAccess, createReference, type WriteActor } from "@/lib/actions/common";
import { runSerializableTransaction } from "@/lib/actions/transaction";
import { asMoney, moneyNumber } from "@/lib/money";
import { tenantBusinessId } from "@/lib/businesses";
import { assertWholeQuantity } from "@/lib/units";

export async function disposeBatch(input: {
  inventoryBatchId?: string;
  quantity?: number;
  reason?: string;
  locationId?: string;
}, actor: WriteActor) {
  const quantity = Number(input.quantity);
  const reason = String(input.reason || "").trim();
  if (!input.inventoryBatchId || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Choose a batch and a positive quantity.");
  }
  if (reason.length < 3) throw new Error("A disposal reason is required.");

  return runSerializableTransaction(async (tx) => {
    const batch = await tx.inventoryBatch.findUnique({
      where: { id: input.inventoryBatchId },
      include: { item: { select: { id: true, name: true, locationId: true, unit: { select: { name: true } } } } },
    });
    if (!batch) throw new Error("Batch was not found.");
    const businessId = tenantBusinessId(batch.locationId);
    assertLocationAccess(actor, businessId, "You do not have access to this batch.");
    const available = Number(batch.remainingQuantity) - Number(batch.reservedQuantity || 0);
    assertWholeQuantity(quantity, batch.item.unit?.name);
    if (quantity > available + Number.EPSILON) {
      throw new Error(`Only ${available} unreserved unit(s) can be disposed.`);
    }
    const reduced = await tx.inventoryBatch.updateMany({
      where: {
        id: batch.id,
        reservedQuantity: Number(batch.reservedQuantity || 0),
        remainingQuantity: { gte: Number(batch.reservedQuantity || 0) + quantity },
      },
      data: {
        remainingQuantity: { decrement: quantity },
        status: Number(batch.remainingQuantity) - quantity <= Number.EPSILON ? "DISPOSED" : batch.status,
      },
    });
    if (reduced.count !== 1) throw new Error("Stock changed while this disposal was being saved.");

    const unitCost = asMoney(batch.buyingPrice);
    const disposal = await tx.inventoryDisposal.create({
      data: {
        locationId: businessId,
        disposalNumber: createReference("DSP"),
        reason,
        disposalDate: new Date(),
        createdById: actor.id,
        lines: {
          create: {
            itemId: batch.itemId,
            inventoryBatchId: batch.id,
            quantity,
            unitCost,
            totalLoss: unitCost.mul(quantity).toDecimalPlaces(2),
          },
        },
      },
    });
    await tx.inventoryMovement.create({
      data: {
        itemId: batch.itemId,
        locationId: batch.locationId,
        inventoryBatchId: batch.id,
        type: "DISPOSAL",
        quantity: -quantity,
        beforeQuantity: batch.remainingQuantity,
        afterQuantity: Number(batch.remainingQuantity) - quantity,
        referenceType: "DISPOSAL",
        referenceId: disposal.id,
        note: reason,
        createdById: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        locationId: businessId,
        action: "DISPOSE",
        module: "Inventory",
        tableName: "InventoryDisposal",
        recordId: disposal.id,
        newData: { quantity, reason, batchCode: batch.batchCode, loss: moneyNumber(unitCost.mul(quantity)) },
      },
    });
    return { id: disposal.id };
  });
}
