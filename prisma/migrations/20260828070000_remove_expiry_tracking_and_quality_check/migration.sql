-- Rename stock_retest -> quality_check in place first (relabels existing
-- rows automatically, no data loss) before the enum is rebuilt below.
ALTER TYPE "SeriesType" RENAME VALUE 'stock_retest' TO 'quality_check';

-- expiry_extension is being dropped entirely (feature removed). These are
-- unused per-store/per-FY numbering counters, never allocated against, so
-- deleting them ahead of the enum rebuild below is safe.
DELETE FROM "numbering_series" WHERE "series_type" = 'expiry_extension';

-- AlterEnum
ALTER TYPE "ReasonCodeCategory" ADD VALUE 'quality_check';

-- AlterEnum (drop expiry_extension — Postgres has no DROP VALUE, so rebuild)
BEGIN;
CREATE TYPE "SeriesType_new" AS ENUM ('cash_bill', 'credit_bill', 'stock_inward', 'credit_note', 'stock_damage', 'stock_block', 'stock_transfer', 'positive_adjustment', 'negative_adjustment', 'opening_balance', 'entry_correction', 'payment_request', 'refund', 'bill_cancellation', 'bill_return', 'bill_payment', 'shift', 'online_bill', 'quality_check', 'product_request');
ALTER TABLE "numbering_series" ALTER COLUMN "series_type" TYPE "SeriesType_new" USING ("series_type"::text::"SeriesType_new");
ALTER TYPE "SeriesType" RENAME TO "SeriesType_old";
ALTER TYPE "SeriesType_new" RENAME TO "SeriesType";
DROP TYPE "public"."SeriesType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "stock_expiry_extensions" DROP CONSTRAINT "stock_expiry_extensions_extended_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_expiry_extensions" DROP CONSTRAINT "stock_expiry_extensions_financial_year_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_expiry_extensions" DROP CONSTRAINT "stock_expiry_extensions_store_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_inward_items" DROP CONSTRAINT "stock_inward_items_expiry_invalidated_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_opening_items" DROP CONSTRAINT "stock_opening_items_expiry_invalidated_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_positive_adjustment_items" DROP CONSTRAINT "stock_positive_adjustment_items_expiry_invalidated_by_user_fkey";

-- DropForeignKey
ALTER TABLE "stock_retest_items" DROP CONSTRAINT "stock_retest_items_damage_item_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_retest_items" DROP CONSTRAINT "stock_retest_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_retest_items" DROP CONSTRAINT "stock_retest_items_stock_retest_main_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_retest_mains" DROP CONSTRAINT "stock_retest_mains_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_retest_mains" DROP CONSTRAINT "stock_retest_mains_financial_year_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_retest_mains" DROP CONSTRAINT "stock_retest_mains_store_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_retest_mains" DROP CONSTRAINT "stock_retest_mains_warehouse_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_transfer_items" DROP CONSTRAINT "stock_transfer_items_expiry_invalidated_by_user_id_fkey";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "track_expiry";

-- AlterTable
ALTER TABLE "stock_inward_items" DROP COLUMN "expiry_date",
DROP COLUMN "expiry_invalidated",
DROP COLUMN "expiry_invalidated_at",
DROP COLUMN "expiry_invalidated_by_user_id";

-- AlterTable
ALTER TABLE "stock_opening_items" DROP COLUMN "expiry_date",
DROP COLUMN "expiry_invalidated",
DROP COLUMN "expiry_invalidated_at",
DROP COLUMN "expiry_invalidated_by_user_id";

-- AlterTable
ALTER TABLE "stock_positive_adjustment_items" DROP COLUMN "expiry_date",
DROP COLUMN "expiry_invalidated",
DROP COLUMN "expiry_invalidated_at",
DROP COLUMN "expiry_invalidated_by_user_id";

-- AlterTable
ALTER TABLE "stock_transfer_items" DROP COLUMN "expiry_date",
DROP COLUMN "expiry_invalidated",
DROP COLUMN "expiry_invalidated_at",
DROP COLUMN "expiry_invalidated_by_user_id";

-- DropTable
DROP TABLE "stock_expiry_extensions";

-- DropTable
DROP TABLE "stock_retest_items";

-- DropTable
DROP TABLE "stock_retest_mains";

-- DropEnum
DROP TYPE "StockExpirySourceItemType";

-- CreateTable
CREATE TABLE "stock_quality_check_mains" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_quality_check_mains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_quality_check_items" (
    "id" TEXT NOT NULL,
    "stock_quality_check_main_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_barcode" TEXT NOT NULL,
    "product_price" DECIMAL(12,2) NOT NULL,
    "product_hsn_code" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason_code_id" TEXT NOT NULL,

    CONSTRAINT "stock_quality_check_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stock_quality_check_mains" ADD CONSTRAINT "stock_quality_check_mains_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_quality_check_mains" ADD CONSTRAINT "stock_quality_check_mains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_quality_check_mains" ADD CONSTRAINT "stock_quality_check_mains_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_quality_check_mains" ADD CONSTRAINT "stock_quality_check_mains_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_quality_check_items" ADD CONSTRAINT "stock_quality_check_items_stock_quality_check_main_id_fkey" FOREIGN KEY ("stock_quality_check_main_id") REFERENCES "stock_quality_check_mains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_quality_check_items" ADD CONSTRAINT "stock_quality_check_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_quality_check_items" ADD CONSTRAINT "stock_quality_check_items_reason_code_id_fkey" FOREIGN KEY ("reason_code_id") REFERENCES "reason_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
