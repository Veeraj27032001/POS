-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "tax_engine_id" TEXT;

-- CreateTable
CREATE TABLE "tax_engines" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_engines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hsn_codes" (
    "id" TEXT NOT NULL,
    "hsn_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cgst_rate" DECIMAL(5,2) NOT NULL,
    "sgst_rate" DECIMAL(5,2) NOT NULL,
    "igst_rate" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "hsn_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_engines_code_key" ON "tax_engines"("code");

-- CreateIndex
CREATE UNIQUE INDEX "hsn_codes_hsn_code_key" ON "hsn_codes"("hsn_code");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_tax_engine_id_fkey" FOREIGN KEY ("tax_engine_id") REFERENCES "tax_engines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: add cash_denominations' new store/currency columns nullable
-- first so existing rows (seeded with a free-text "currency" and no store)
-- can be backfilled before the NOT NULL constraint is enforced.
ALTER TABLE "cash_denominations" ADD COLUMN     "currency_id" TEXT;
ALTER TABLE "cash_denominations" ADD COLUMN     "store_id" TEXT;

UPDATE "cash_denominations"
SET "currency_id" = (SELECT "id" FROM "currencies" WHERE "code" = 'INR' LIMIT 1)
WHERE "currency_id" IS NULL;

UPDATE "cash_denominations"
SET "store_id" = (SELECT "id" FROM "stores" ORDER BY "created_at" ASC LIMIT 1)
WHERE "store_id" IS NULL;

ALTER TABLE "cash_denominations" ALTER COLUMN "currency_id" SET NOT NULL;
ALTER TABLE "cash_denominations" ALTER COLUMN "store_id" SET NOT NULL;

ALTER TABLE "cash_denominations" DROP COLUMN "currency";

-- AddForeignKey
ALTER TABLE "cash_denominations" ADD CONSTRAINT "cash_denominations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_denominations" ADD CONSTRAINT "cash_denominations_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
