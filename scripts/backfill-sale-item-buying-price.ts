import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.$queryRaw<Array<{ updated_count: bigint }>>`
    WITH updated AS (
      UPDATE "SaleItem" AS si
      SET "buyingPrice" = ib."buyingPrice"
      FROM "InventoryBatch" AS ib
      WHERE si."inventoryBatchId" = ib."id"
        AND COALESCE(si."buyingPrice", 0) = 0
      RETURNING si."id"
    )
    SELECT COUNT(*)::bigint AS updated_count FROM updated;
  `;

  const updatedCount = Number(result[0]?.updated_count || 0);
  console.log(`Backfilled buying price for ${updatedCount} sale item(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
