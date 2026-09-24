import pg from "pg";

const connectionString = process.env.STAGING_DATABASE_URL || process.env.TEST_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Set STAGING_DATABASE_URL or TEST_DATABASE_URL. This check intentionally refuses to use DATABASE_URL.",
  );
}

const moneyColumns = [
  ["Item", "defaultBuyingPrice"],
  ["Item", "defaultSellingPrice"],
  ["InventoryBatch", "buyingPrice"],
  ["InventoryBatch", "sellingPrice"],
  ["Purchase", "totalAmount"],
  ["Purchase", "paidAmount"],
  ["Purchase", "debtAmount"],
  ["PurchaseItem", "buyingPrice"],
  ["PurchaseItem", "sellingPrice"],
  ["PurchaseItem", "totalAmount"],
  ["SupplierPayment", "amount"],
  ["Sale", "subTotal"],
  ["Sale", "discount"],
  ["Sale", "totalAmount"],
  ["Sale", "cashAmount"],
  ["Sale", "bankAmount"],
  ["Sale", "creditAmount"],
  ["SaleItem", "buyingPrice"],
  ["SaleItem", "sellingPrice"],
  ["SaleItem", "discount"],
  ["SaleItem", "totalAmount"],
  ["CustomerPayment", "amount"],
  ["BankAccount", "currentBalance"],
  ["BankTransaction", "amount"],
  ["Expense", "amount"],
] as const;

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

const client = new pg.Client({ connectionString });

try {
  await client.connect();

  const failures: string[] = [];
  for (const [tableName, columnName] of moneyColumns) {
    const table = quoteIdentifier(tableName);
    const column = quoteIdentifier(columnName);
    const result = await client.query<{ unsafe_count: string }>(`
      SELECT count(*)::text AS unsafe_count
      FROM ${table}
      WHERE ${column} IS NOT NULL
        AND CASE
          WHEN ${column}::text IN ('NaN', 'Infinity', '-Infinity') THEN true
          ELSE abs(${column}::numeric) > 9999999999999999.99
            OR ${column}::numeric <> round(${column}::numeric, 2)
        END
    `);
    const unsafeCount = Number(result.rows[0]?.unsafe_count || 0);
    if (unsafeCount > 0) failures.push(`${tableName}.${columnName}: ${unsafeCount}`);
  }

  if (failures.length > 0) {
    throw new Error(`Migration is not data-preserving:\n${failures.join("\n")}`);
  }

  console.log(`Ready: all ${moneyColumns.length} monetary columns can be converted without changing values.`);
} finally {
  await client.end().catch(() => undefined);
}
