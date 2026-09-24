CREATE TABLE IF NOT EXISTS "SaleReturn" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "returnNumber" TEXT NOT NULL,
  "refundMethod" TEXT NOT NULL,
  "bankAccountId" TEXT,
  "totalAmount" DECIMAL(18, 2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SaleReturnLine" (
  "id" TEXT NOT NULL,
  "saleReturnId" TEXT NOT NULL,
  "saleItemId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "inventoryBatchId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitPrice" DECIMAL(18, 2) NOT NULL,
  "totalAmount" DECIMAL(18, 2) NOT NULL,
  CONSTRAINT "SaleReturnLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseReturn" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "returnNumber" TEXT NOT NULL,
  "refundMethod" TEXT NOT NULL,
  "bankAccountId" TEXT,
  "totalAmount" DECIMAL(18, 2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseReturnLine" (
  "id" TEXT NOT NULL,
  "purchaseReturnId" TEXT NOT NULL,
  "purchaseItemId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "inventoryBatchId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitCost" DECIMAL(18, 2) NOT NULL,
  "totalAmount" DECIMAL(18, 2) NOT NULL,
  CONSTRAINT "PurchaseReturnLine_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SaleReturnLine" ADD CONSTRAINT "SaleReturnLine_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "SaleReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
