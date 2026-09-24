ALTER TABLE "Item"
  ADD COLUMN IF NOT EXISTS "genericName" TEXT,
  ADD COLUMN IF NOT EXISTS "brandName" TEXT,
  ADD COLUMN IF NOT EXISTS "dosageForm" TEXT,
  ADD COLUMN IF NOT EXISTS "strength" TEXT,
  ADD COLUMN IF NOT EXISTS "packSize" TEXT,
  ADD COLUMN IF NOT EXISTS "manufacturer" TEXT,
  ADD COLUMN IF NOT EXISTS "countryOfOrigin" TEXT,
  ADD COLUMN IF NOT EXISTS "requiresPrescription" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isControlled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "InventoryBatch"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "reservedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Purchase"
  ADD COLUMN IF NOT EXISTS "fsNumber" TEXT;

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "allowCredit" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(18, 2);

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS "prescriptionNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "patientName" TEXT,
  ADD COLUMN IF NOT EXISTS "prescriberName" TEXT;

CREATE TABLE IF NOT EXISTS "PendingSale" (
  "id" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "voucherCode" TEXT NOT NULL,
  "customerId" TEXT,
  "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "subTotal" DECIMAL(18, 2) NOT NULL,
  "discount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18, 2) NOT NULL,
  "lines" JSONB NOT NULL,
  "prescriptionNumber" TEXT,
  "patientName" TEXT,
  "prescriberName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "saleId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PendingSale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PendingSale_voucherCode_key" ON "PendingSale"("voucherCode");

CREATE TABLE IF NOT EXISTS "InventoryReservation" (
  "id" TEXT NOT NULL,
  "pendingSaleId" TEXT NOT NULL,
  "inventoryBatchId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitCost" DECIMAL(18, 2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryDisposal" (
  "id" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "disposalNumber" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "remarks" TEXT,
  "disposalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryDisposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryDisposalLine" (
  "id" TEXT NOT NULL,
  "disposalId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "inventoryBatchId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitCost" DECIMAL(18, 2) NOT NULL,
  "totalLoss" DECIMAL(18, 2) NOT NULL,
  CONSTRAINT "InventoryDisposalLine_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PendingSale" ADD CONSTRAINT "PendingSale_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PendingSale" ADD CONSTRAINT "PendingSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_pendingSaleId_fkey" FOREIGN KEY ("pendingSaleId") REFERENCES "PendingSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryDisposal" ADD CONSTRAINT "InventoryDisposal_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryDisposalLine" ADD CONSTRAINT "InventoryDisposalLine_disposalId_fkey" FOREIGN KEY ("disposalId") REFERENCES "InventoryDisposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryDisposalLine" ADD CONSTRAINT "InventoryDisposalLine_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
