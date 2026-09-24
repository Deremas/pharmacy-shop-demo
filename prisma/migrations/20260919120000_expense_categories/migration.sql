-- Reusable expense categories per business.

CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
  "id" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_locationId_name_key"
  ON "ExpenseCategory"("locationId", "name");

CREATE INDEX IF NOT EXISTS "ExpenseCategory_locationId_idx"
  ON "ExpenseCategory"("locationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseCategory_locationId_fkey'
  ) THEN
    ALTER TABLE "ExpenseCategory"
      ADD CONSTRAINT "ExpenseCategory_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "Location"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;
