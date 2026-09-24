-- Convert monetary columns from floating point to exact, two-decimal values.
--
-- This migration deliberately fails before changing the schema when an existing
-- value cannot be represented without modification. It never silently rounds,
-- truncates, or replaces production money values.

BEGIN;

DO $$
DECLARE
  target record;
  unsafe_count bigint;
BEGIN
  FOR target IN
    SELECT *
    FROM (VALUES
      ('Item', 'defaultBuyingPrice'),
      ('Item', 'defaultSellingPrice'),
      ('InventoryBatch', 'buyingPrice'),
      ('InventoryBatch', 'sellingPrice'),
      ('Purchase', 'totalAmount'),
      ('Purchase', 'paidAmount'),
      ('Purchase', 'debtAmount'),
      ('PurchaseItem', 'buyingPrice'),
      ('PurchaseItem', 'sellingPrice'),
      ('PurchaseItem', 'totalAmount'),
      ('SupplierPayment', 'amount'),
      ('Sale', 'subTotal'),
      ('Sale', 'discount'),
      ('Sale', 'totalAmount'),
      ('Sale', 'cashAmount'),
      ('Sale', 'bankAmount'),
      ('Sale', 'creditAmount'),
      ('SaleItem', 'buyingPrice'),
      ('SaleItem', 'sellingPrice'),
      ('SaleItem', 'discount'),
      ('SaleItem', 'totalAmount'),
      ('CustomerPayment', 'amount'),
      ('BankAccount', 'currentBalance'),
      ('BankTransaction', 'amount'),
      ('Expense', 'amount')
    ) AS money_columns(table_name, column_name)
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I WHERE %I IS NOT NULL AND CASE '
      || 'WHEN %I::text IN (''NaN'', ''Infinity'', ''-Infinity'') THEN true '
      || 'ELSE abs(%I::numeric) > 9999999999999999.99 '
      || 'OR %I::numeric <> round(%I::numeric, 2) END',
      target.table_name,
      target.column_name,
      target.column_name,
      target.column_name,
      target.column_name,
      target.column_name
    ) INTO unsafe_count;

    IF unsafe_count > 0 THEN
      RAISE EXCEPTION
        'Decimal migration stopped: %.% contains % value(s) that cannot be preserved exactly as numeric(18,2).',
        target.table_name,
        target.column_name,
        unsafe_count;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "Item"
  ALTER COLUMN "defaultBuyingPrice" TYPE DECIMAL(18, 2) USING "defaultBuyingPrice"::numeric,
  ALTER COLUMN "defaultSellingPrice" TYPE DECIMAL(18, 2) USING "defaultSellingPrice"::numeric;

ALTER TABLE "InventoryBatch"
  ALTER COLUMN "buyingPrice" TYPE DECIMAL(18, 2) USING "buyingPrice"::numeric,
  ALTER COLUMN "sellingPrice" TYPE DECIMAL(18, 2) USING "sellingPrice"::numeric;

ALTER TABLE "Purchase"
  ALTER COLUMN "totalAmount" TYPE DECIMAL(18, 2) USING "totalAmount"::numeric,
  ALTER COLUMN "paidAmount" TYPE DECIMAL(18, 2) USING "paidAmount"::numeric,
  ALTER COLUMN "debtAmount" TYPE DECIMAL(18, 2) USING "debtAmount"::numeric;

ALTER TABLE "PurchaseItem"
  ALTER COLUMN "buyingPrice" TYPE DECIMAL(18, 2) USING "buyingPrice"::numeric,
  ALTER COLUMN "sellingPrice" TYPE DECIMAL(18, 2) USING "sellingPrice"::numeric,
  ALTER COLUMN "totalAmount" TYPE DECIMAL(18, 2) USING "totalAmount"::numeric;

ALTER TABLE "SupplierPayment"
  ALTER COLUMN "amount" TYPE DECIMAL(18, 2) USING "amount"::numeric;

ALTER TABLE "Sale"
  ALTER COLUMN "subTotal" TYPE DECIMAL(18, 2) USING "subTotal"::numeric,
  ALTER COLUMN "discount" TYPE DECIMAL(18, 2) USING "discount"::numeric,
  ALTER COLUMN "totalAmount" TYPE DECIMAL(18, 2) USING "totalAmount"::numeric,
  ALTER COLUMN "cashAmount" TYPE DECIMAL(18, 2) USING "cashAmount"::numeric,
  ALTER COLUMN "bankAmount" TYPE DECIMAL(18, 2) USING "bankAmount"::numeric,
  ALTER COLUMN "creditAmount" TYPE DECIMAL(18, 2) USING "creditAmount"::numeric;

ALTER TABLE "SaleItem"
  ALTER COLUMN "buyingPrice" TYPE DECIMAL(18, 2) USING "buyingPrice"::numeric,
  ALTER COLUMN "sellingPrice" TYPE DECIMAL(18, 2) USING "sellingPrice"::numeric,
  ALTER COLUMN "discount" TYPE DECIMAL(18, 2) USING "discount"::numeric,
  ALTER COLUMN "totalAmount" TYPE DECIMAL(18, 2) USING "totalAmount"::numeric;

ALTER TABLE "CustomerPayment"
  ALTER COLUMN "amount" TYPE DECIMAL(18, 2) USING "amount"::numeric;

ALTER TABLE "BankAccount"
  ALTER COLUMN "currentBalance" TYPE DECIMAL(18, 2) USING "currentBalance"::numeric;

ALTER TABLE "BankTransaction"
  ALTER COLUMN "amount" TYPE DECIMAL(18, 2) USING "amount"::numeric;

ALTER TABLE "Expense"
  ALTER COLUMN "amount" TYPE DECIMAL(18, 2) USING "amount"::numeric;

COMMIT;
