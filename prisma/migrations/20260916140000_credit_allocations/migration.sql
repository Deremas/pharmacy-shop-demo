-- Exact per-sale credit settlement allocations.

CREATE TABLE IF NOT EXISTS "CustomerPaymentAllocation" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,

  CONSTRAINT "CustomerPaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CustomerPaymentAllocation_paymentId_idx"
  ON "CustomerPaymentAllocation"("paymentId");

CREATE INDEX IF NOT EXISTS "CustomerPaymentAllocation_saleId_idx"
  ON "CustomerPaymentAllocation"("saleId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerPaymentAllocation_paymentId_fkey'
  ) THEN
    ALTER TABLE "CustomerPaymentAllocation"
      ADD CONSTRAINT "CustomerPaymentAllocation_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "CustomerPayment"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerPaymentAllocation_saleId_fkey'
  ) THEN
    ALTER TABLE "CustomerPaymentAllocation"
      ADD CONSTRAINT "CustomerPaymentAllocation_saleId_fkey"
      FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
      ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "CustomerPaymentAllocation" ("id", "paymentId", "saleId", "amount")
SELECT replace(gen_random_uuid()::text, '-', ''), "id", "saleId", "amount"
FROM "CustomerPayment"
WHERE "saleId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "CustomerPaymentAllocation" allocation
    WHERE allocation."paymentId" = "CustomerPayment"."id"
  );

DO $$
DECLARE
  pay RECORD;
  sale RECORD;
  remaining NUMERIC(18, 2);
  outstanding NUMERIC(18, 2);
  alloc NUMERIC(18, 2);
BEGIN
  FOR pay IN
    SELECT "id", "customerId", "amount"
    FROM "CustomerPayment"
    WHERE "saleId" IS NULL
    ORDER BY "paymentDate" ASC, "createdAt" ASC, "id" ASC
  LOOP
    IF EXISTS (
      SELECT 1 FROM "CustomerPaymentAllocation" WHERE "paymentId" = pay."id"
    ) THEN
      CONTINUE;
    END IF;

    remaining := pay."amount";
    FOR sale IN
      SELECT
        s."id",
        (s."creditAmount" - COALESCE((
          SELECT SUM(a."amount") FROM "CustomerPaymentAllocation" a WHERE a."saleId" = s."id"
        ), 0)) AS outstanding
      FROM "Sale" s
      WHERE s."customerId" = pay."customerId"
        AND s."creditAmount" > 0
      ORDER BY s."saleDate" ASC, s."createdAt" ASC, s."id" ASC
    LOOP
      EXIT WHEN remaining <= 0;
      outstanding := GREATEST(sale.outstanding, 0);
      CONTINUE WHEN outstanding <= 0;
      alloc := LEAST(outstanding, remaining);
      INSERT INTO "CustomerPaymentAllocation" ("id", "paymentId", "saleId", "amount")
      VALUES (replace(gen_random_uuid()::text, '-', ''), pay."id", sale."id", alloc);
      remaining := remaining - alloc;
    END LOOP;
  END LOOP;
END $$;
