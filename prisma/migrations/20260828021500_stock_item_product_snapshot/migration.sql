
-- AlterTable
ALTER TABLE "product_request_items" ADD COLUMN     "product_barcode" TEXT NOT NULL,
ADD COLUMN     "product_hsn_code" TEXT,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "product_price" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "stock_block_items" ADD COLUMN     "product_barcode" TEXT NOT NULL,
ADD COLUMN     "product_hsn_code" TEXT,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "product_price" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "stock_damage_items" ADD COLUMN     "product_barcode" TEXT NOT NULL,
ADD COLUMN     "product_hsn_code" TEXT,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "product_price" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "stock_inward_items" ADD COLUMN     "product_barcode" TEXT NOT NULL,
ADD COLUMN     "product_hsn_code" TEXT,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "product_price" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "stock_negative_adjustment_items" ADD COLUMN     "product_barcode" TEXT NOT NULL,
ADD COLUMN     "product_hsn_code" TEXT,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "product_price" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "stock_opening_items" ADD COLUMN     "product_barcode" TEXT NOT NULL,
ADD COLUMN     "product_hsn_code" TEXT,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "product_price" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "stock_positive_adjustment_items" ADD COLUMN     "product_barcode" TEXT NOT NULL,
ADD COLUMN     "product_hsn_code" TEXT,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "product_price" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "stock_retest_items" ADD COLUMN     "product_barcode" TEXT NOT NULL,
ADD COLUMN     "product_hsn_code" TEXT,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "product_price" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "stock_transfer_items" ADD COLUMN     "product_barcode" TEXT NOT NULL,
ADD COLUMN     "product_hsn_code" TEXT,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "product_price" DECIMAL(12,2) NOT NULL;

