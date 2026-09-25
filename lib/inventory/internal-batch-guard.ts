import { isInternalBatchCode } from "@/lib/inventory/receipt-batch";

type BatchCodeLookup = {
  findFirst: (args: {
    where: { batchCode: { equals: string; mode: "insensitive" } };
    select: { id: true };
  }) => Promise<{ id: string } | null>;
};

export async function assertInternalBatchCodeAvailable(
  db: { inventoryBatch: BatchCodeLookup; purchaseItem: BatchCodeLookup; transferItem: BatchCodeLookup },
  batchCode: string,
) {
  if (!isInternalBatchCode(batchCode)) return;
  const where = { batchCode: { equals: batchCode.trim(), mode: "insensitive" as const } };
  const select = { id: true as const };
  const [batch, purchase, transfer] = await Promise.all([
    db.inventoryBatch.findFirst({ where, select }),
    db.purchaseItem.findFirst({ where, select }),
    db.transferItem.findFirst({ where, select }),
  ]);
  if (batch || purchase || transfer) {
    throw new Error("That internal code is already used. Press Internal again.");
  }
}
