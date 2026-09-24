-- Isolate catalogs, people, banks, and settings per business.
-- Users, roles, and permissions stay global.

INSERT INTO "Location" ("id", "name", "type", "location", "isActive", "createdAt", "updatedAt")
VALUES
  ('loc-all-american-shoes', 'All American Shoes', 'BUSINESS', 'Addis Ababa', true, NOW(), NOW()),
  ('loc-lanchi-hair', 'Lanchi Human Hair', 'BUSINESS', 'Addis Ababa', true, NOW(), NOW()),
  ('loc-alpha-male', 'Alpha Male Clothing', 'BUSINESS', 'Addis Ababa', true, NOW(), NOW())
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "location" = EXCLUDED."location",
  "isActive" = true,
  "updatedAt" = NOW();

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "locationId" TEXT;

DO $$
DECLARE
  fallback_id TEXT;
BEGIN
  SELECT "id" INTO fallback_id
  FROM "Location"
  WHERE "id" IN ('loc-all-american-shoes', 'loc-shop-main')
  ORDER BY CASE WHEN "id" = 'loc-all-american-shoes' THEN 0 ELSE 1 END
  LIMIT 1;

  IF fallback_id IS NULL THEN
    SELECT "id" INTO fallback_id FROM "Location" ORDER BY "createdAt" ASC LIMIT 1;
  END IF;

  IF fallback_id IS NULL THEN
    RAISE EXCEPTION 'No location available to isolate business data';
  END IF;

  UPDATE "User" SET "locationId" = 'loc-all-american-shoes' WHERE "locationId" = 'loc-shop-main';
  UPDATE "Purchase" SET "locationId" = 'loc-all-american-shoes' WHERE "locationId" = 'loc-shop-main';
  UPDATE "Sale" SET "locationId" = 'loc-all-american-shoes' WHERE "locationId" = 'loc-shop-main';
  UPDATE "InventoryBatch" SET "locationId" = 'loc-all-american-shoes' WHERE "locationId" = 'loc-shop-main';
  UPDATE "Expense" SET "locationId" = 'loc-all-american-shoes' WHERE "locationId" = 'loc-shop-main';
  UPDATE "BankTransaction" SET "locationId" = 'loc-all-american-shoes' WHERE "locationId" = 'loc-shop-main';
  UPDATE "InventoryMovement" SET "locationId" = 'loc-all-american-shoes' WHERE "locationId" = 'loc-shop-main';
  UPDATE "SupplierPayment" SET "locationId" = 'loc-all-american-shoes' WHERE "locationId" = 'loc-shop-main';
  UPDATE "CustomerPayment" SET "locationId" = 'loc-all-american-shoes' WHERE "locationId" = 'loc-shop-main';
  UPDATE "AuditLog" SET "locationId" = 'loc-all-american-shoes' WHERE "locationId" = 'loc-shop-main';
  UPDATE "Transfer" SET "sourceLocationId" = 'loc-all-american-shoes' WHERE "sourceLocationId" = 'loc-shop-main';
  UPDATE "Transfer" SET "destinationLocationId" = 'loc-all-american-shoes' WHERE "destinationLocationId" = 'loc-shop-main';

  UPDATE "Category" SET "locationId" = fallback_id WHERE "locationId" IS NULL;
  UPDATE "Unit" SET "locationId" = fallback_id WHERE "locationId" IS NULL;
  UPDATE "Item" SET "locationId" = fallback_id WHERE "locationId" IS NULL;
  UPDATE "Supplier" SET "locationId" = fallback_id WHERE "locationId" IS NULL;
  UPDATE "Customer" SET "locationId" = fallback_id WHERE "locationId" IS NULL;
  UPDATE "BankAccount" SET "locationId" = fallback_id WHERE "locationId" IS NULL;
  UPDATE "Setting" SET "locationId" = fallback_id WHERE "locationId" IS NULL;
END $$;

ALTER TABLE "Item" DROP CONSTRAINT IF EXISTS "Item_code_key";
ALTER TABLE "Item" DROP CONSTRAINT IF EXISTS "Item_barcode_key";
ALTER TABLE "Setting" DROP CONSTRAINT IF EXISTS "Setting_key_key";

ALTER TABLE "Category" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Unit" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Item" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Supplier" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "BankAccount" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Setting" ALTER COLUMN "locationId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Category_locationId_fkey'
  ) THEN
    ALTER TABLE "Category" ADD CONSTRAINT "Category_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Unit_locationId_fkey'
  ) THEN
    ALTER TABLE "Unit" ADD CONSTRAINT "Unit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Item_locationId_fkey'
  ) THEN
    ALTER TABLE "Item" ADD CONSTRAINT "Item_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Supplier_locationId_fkey'
  ) THEN
    ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_locationId_fkey'
  ) THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BankAccount_locationId_fkey'
  ) THEN
    ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Setting_locationId_fkey'
  ) THEN
    ALTER TABLE "Setting" ADD CONSTRAINT "Setting_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Category_locationId_name_key" ON "Category"("locationId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Unit_locationId_name_key" ON "Unit"("locationId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Item_locationId_code_key" ON "Item"("locationId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "Item_locationId_barcode_key" ON "Item"("locationId", "barcode");
CREATE UNIQUE INDEX IF NOT EXISTS "Setting_locationId_key_key" ON "Setting"("locationId", "key");

INSERT INTO "Setting" ("id", "locationId", "key", "value", "createdAt", "updatedAt")
SELECT
  concat('set-', dest."id", '-', src."key"),
  dest."id",
  src."key",
  CASE WHEN src."key" = 'companyName' THEN dest."name" ELSE src."value" END,
  NOW(),
  NOW()
FROM "Location" dest
JOIN "Setting" src ON src."locationId" = 'loc-all-american-shoes'
WHERE dest."id" IN ('loc-lanchi-hair', 'loc-alpha-male')
ON CONFLICT ("locationId", "key") DO NOTHING;

INSERT INTO "BankAccount" ("id", "locationId", "accountType", "displayName", "bankName", "accountNumber", "currentBalance", "isActive", "createdAt", "updatedAt")
SELECT
  concat('cash-', loc."id"),
  loc."id",
  'CASH',
  concat(loc."name", ' Cash'),
  'Internal',
  concat('CASH-', upper(right(loc."id", 6))),
  0,
  true,
  NOW(),
  NOW()
FROM "Location" loc
WHERE loc."id" IN ('loc-all-american-shoes', 'loc-lanchi-hair', 'loc-alpha-male')
ON CONFLICT ("id") DO UPDATE SET
  "locationId" = EXCLUDED."locationId",
  "accountType" = 'CASH',
  "isActive" = true,
  "updatedAt" = NOW();

UPDATE "BankAccount"
SET "locationId" = 'loc-all-american-shoes'
WHERE "id" = 'cash-main' AND "locationId" IS DISTINCT FROM 'loc-all-american-shoes';

UPDATE "Location"
SET "name" = 'All American Shoes', "type" = 'BUSINESS', "isActive" = true, "updatedAt" = NOW()
WHERE "id" = 'loc-all-american-shoes';

UPDATE "Location"
SET "isActive" = false, "updatedAt" = NOW()
WHERE "id" = 'loc-shop-main';
