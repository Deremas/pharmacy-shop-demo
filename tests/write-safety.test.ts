import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { withWriteConflictRetry } from "../lib/actions/transaction";
import { asMoney, historicalSaleUnitCost } from "../lib/money";
import { customerPaymentSchema, expenseCategorySchema, expenseSchema } from "../lib/validation/finance";
import { allocatePaymentFifo, creditStatus, customerCreditBalance, unpaidCreditSales } from "../lib/finance/credit-ledger";
import { createPurchaseSchema } from "../lib/validation/purchase";
import { createSaleSchema } from "../lib/validation/sale";
import { transferSchema } from "../lib/validation/transfer";

test("money uses fixed two-decimal arithmetic", () => {
  assert.equal(asMoney("0.10").plus(asMoney("0.20")).toFixed(2), "0.30");
  assert.equal(historicalSaleUnitCost(0, 3250).toFixed(2), "3250.00");
  assert.equal(historicalSaleUnitCost(3100, 3250).toFixed(2), "3100.00");
});

test("sale validation accepts the browser payload and rejects duplicate items", () => {
  const payload = {
    locationId: "loc-1",
    saleDate: new Date(),
    subTotal: 20,
    discount: 2,
    totalAmount: 18,
    cashAmount: 18,
    bankAmount: 0,
    creditAmount: 0,
    paymentMethod: "CASH",
    items: [{ itemId: "item-1", qty: 2, price: 10, discount: 2, total: 18 }],
  };
  assert.equal(createSaleSchema.safeParse(payload).success, true);
  assert.equal(createSaleSchema.safeParse({ ...payload, items: [...payload.items, payload.items[0]] }).success, false);
});

test("purchase, expense, and transfer browser payloads validate", () => {
  assert.equal(createPurchaseSchema.safeParse({
    supplierId: "supplier-1",
    locationId: "loc-1",
    stockLocationId: "loc-1",
    purchaseDate: new Date(),
    totalAmount: 20,
    paidAmount: 20,
    cashAmount: 20,
    bankAmount: 0,
    debtAmount: 0,
    paymentMethod: "CASH",
    items: [{ itemId: "item-1", qty: 2, unitCost: 10, sellingPrice: 12, total: 20, batchCode: "BATCH-1", expireDate: new Date("2099-01-01") }],
  }).success, true);
  assert.equal(createPurchaseSchema.safeParse({
    supplierId: "supplier-1",
    locationId: "loc-1",
    purchaseDate: new Date(),
    totalAmount: 20,
    paidAmount: 20,
    cashAmount: 20,
    bankAmount: 0,
    debtAmount: 0,
    paymentMethod: "CASH",
    items: [{ itemId: "item-1", qty: 2, unitCost: 10, sellingPrice: 12, total: 20, batchCode: "BATCH-1", expireDate: new Date("2099-01-01") }],
  }).success, false);
  assert.equal(expenseSchema.safeParse({
    locationId: "loc-1", category: "Utilities", description: "", amount: 10, paymentMethod: "CASH", date: new Date(),
  }).success, true);
  assert.equal(expenseCategorySchema.safeParse({ locationId: "loc-1", name: "Rent" }).success, true);
  assert.equal(expenseCategorySchema.safeParse({ locationId: "loc-1", name: "" }).success, false);
  assert.equal(transferSchema.safeParse({
    fromLocationId: "loc-1", toLocationId: "loc-2", items: [{ itemId: "item-1", quantity: 1 }], date: new Date(), status: "COMPLETED",
  }).success, true);
});

test("serializable conflicts are retried and non-conflict errors are not", async () => {
  let attempts = 0;
  const result = await withWriteConflictRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error("write conflict"), { code: "P2034" });
    return "saved";
  });
  assert.equal(result, "saved");
  assert.equal(attempts, 3);

  let nonConflictAttempts = 0;
  await assert.rejects(() => withWriteConflictRetry(async () => {
    nonConflictAttempts += 1;
    throw new Error("validation failed");
  }));
  assert.equal(nonConflictAttempts, 1);
});

test("the money migration protects every Decimal column and never rounds values", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync(
    "prisma/migrations/20260804130000_decimal_money/migration.sql",
    "utf8",
  );
  const decimalColumnCount = schema.split(/\r?\n/).filter((line) => /\sDecimal\s/.test(line)).length;
  const guardedColumnCount = [...migration.matchAll(/^\s*\('[^']+', '[^']+'\),?$/gm)].length;

  assert.equal(decimalColumnCount, 38);
  assert.equal(guardedColumnCount, 25);
  const allocationMigration = readFileSync(
    "prisma/migrations/20260916140000_credit_allocations/migration.sql",
    "utf8",
  );
  const pharmacyMigration = readFileSync(
    "prisma/migrations/20260924120000_pharmacy_batches/migration.sql",
    "utf8",
  );
  assert.match(allocationMigration, /"amount" DECIMAL\(18, 2\) NOT NULL/);
  assert.match(pharmacyMigration, /"subTotal" DECIMAL\(18, 2\) NOT NULL/);
  assert.match(pharmacyMigration, /"creditLimit" DECIMAL\(18, 2\)/);
  assert.match(pharmacyMigration, /"unitCost" DECIMAL\(18, 2\) NOT NULL/);
  assert.match(pharmacyMigration, /"totalLoss" DECIMAL\(18, 2\) NOT NULL/);
  const returnsMigration = readFileSync(
    "prisma/migrations/20260924153000_returns_and_mobile/migration.sql",
    "utf8",
  );
  assert.match(returnsMigration, /"totalAmount" DECIMAL\(18, 2\) NOT NULL/);
  assert.match(returnsMigration, /"unitPrice" DECIMAL\(18, 2\) NOT NULL/);
  assert.match(returnsMigration, /"unitCost" DECIMAL\(18, 2\) NOT NULL/);
  assert.match(migration, /RAISE EXCEPTION/);
  assert.doesNotMatch(migration, /USING\s+round\(/i);
});

test("credit settlement allocates FIFO and never overpays a sale", () => {
  const sales = [
    { id: "sale-old", customerId: "cust-1", creditAmount: 100, saleDate: "2026-01-01" },
    { id: "sale-new", customerId: "cust-1", creditAmount: 50, saleDate: "2026-02-01" },
  ];
  const unpaid = unpaidCreditSales("cust-1", sales, [], []);
  assert.deepEqual(unpaid.map((sale) => sale.saleId), ["sale-old", "sale-new"]);

  const allocations = allocatePaymentFifo(unpaid, 120);
  assert.deepEqual(allocations, [
    { saleId: "sale-old", amount: 100 },
    { saleId: "sale-new", amount: 20 },
  ]);
  assert.equal(creditStatus(50, 20), "PARTIAL");
  assert.equal(creditStatus(100, 100), "SETTLED");
  assert.equal(creditStatus(50, 0), "PENDING");
  assert.equal(customerCreditBalance("cust-1", sales, [{ id: "pay-1", customerId: "cust-1", amount: 120 }]), 30);
});

test("customer payment validation accepts a selected sale and requires a bank account", () => {
  assert.equal(customerPaymentSchema.safeParse({
    customerId: "cust-1",
    saleId: "sale-1",
    amount: 10,
    method: "CASH",
    date: new Date(),
  }).success, true);
  assert.equal(customerPaymentSchema.safeParse({
    customerId: "cust-1",
    amount: 10,
    method: "BANK",
    date: new Date(),
  }).success, false);
});

