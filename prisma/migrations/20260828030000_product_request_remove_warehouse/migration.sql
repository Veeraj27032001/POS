-- DropForeignKey
ALTER TABLE "product_request_mains" DROP CONSTRAINT "product_request_mains_warehouse_id_fkey";
-- AlterTable
ALTER TABLE "product_request_mains" DROP COLUMN "warehouse_id";
