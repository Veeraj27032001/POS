-- AlterTable
ALTER TABLE "bills" ADD COLUMN "bill_date" DATE;

-- Backfill existing rows from their creation date, then enforce NOT NULL.
UPDATE "bills" SET "bill_date" = "created_at"::date WHERE "bill_date" IS NULL;

ALTER TABLE "bills" ALTER COLUMN "bill_date" SET NOT NULL;
