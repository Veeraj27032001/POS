-- AlterEnum
ALTER TYPE "PaymentMethodType" ADD VALUE 'upi';

-- AlterEnum
ALTER TYPE "SeriesType" ADD VALUE 'product_request';

-- DropForeignKey
ALTER TABLE "price_list_items" DROP CONSTRAINT "price_list_items_product_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_tax_code_id_fkey";

-- DropForeignKey
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_uom_id_fkey";

-- DropIndex
DROP INDEX "price_list_items_price_list_id_product_variant_id_key";

-- AlterTable
ALTER TABLE "price_list_items" DROP COLUMN "product_variant_id",
ADD COLUMN     "product_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "default_cost_price" DECIMAL(12,2),
ADD COLUMN     "pack_size" DECIMAL(10,3),
ADD COLUMN     "price" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "reorder_level" INTEGER,
ADD COLUMN     "sku_barcode" TEXT,
ADD COLUMN     "stock_tracked" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "system_barcode" TEXT NOT NULL,
ADD COLUMN     "uom_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "product_variants";

-- CreateIndex
CREATE UNIQUE INDEX "price_list_items_price_list_id_product_id_key" ON "price_list_items"("price_list_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_barcode_key" ON "products"("sku_barcode");

-- CreateIndex
CREATE UNIQUE INDEX "products_system_barcode_key" ON "products"("system_barcode");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

