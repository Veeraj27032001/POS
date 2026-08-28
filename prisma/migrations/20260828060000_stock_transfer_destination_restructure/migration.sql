-- DropForeignKey
ALTER TABLE "stock_transfer_mains" DROP CONSTRAINT "stock_transfer_mains_destination_warehouse_id_fkey";

-- AlterTable
ALTER TABLE "stock_transfer_items" ADD COLUMN     "destination_warehouse_id" TEXT;

-- AlterTable
ALTER TABLE "stock_transfer_mains" DROP COLUMN "destination_warehouse_id",
ADD COLUMN     "destination_store_id" TEXT NOT NULL,
ADD COLUMN     "received_date" DATE;

-- AddForeignKey
ALTER TABLE "stock_transfer_mains" ADD CONSTRAINT "stock_transfer_mains_destination_store_id_fkey" FOREIGN KEY ("destination_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
