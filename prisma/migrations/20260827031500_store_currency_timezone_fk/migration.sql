-- AlterTable: add the new FK columns first, nullable, alongside the old string columns
ALTER TABLE "stores" ADD COLUMN     "currency_id" TEXT,
ADD COLUMN     "timezone_id" TEXT;

-- Backfill from the existing string values before they're dropped
UPDATE "stores" s SET "currency_id" = c.id
FROM "currencies" c WHERE c.code = s."default_currency";

UPDATE "stores" s SET "timezone_id" = t.id
FROM "timezones" t WHERE t.name = s."timezone";

-- Now safe to drop the old string columns
ALTER TABLE "stores" DROP COLUMN "default_currency",
DROP COLUMN "timezone";

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_timezone_id_fkey" FOREIGN KEY ("timezone_id") REFERENCES "timezones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
