ALTER TABLE "ecommerce_orders" ALTER COLUMN "api_credential_id" SET NOT NULL;

ALTER TABLE "ecommerce_order_item_locks" ADD CONSTRAINT "ecommerce_order_item_locks_stock_lock_id_fkey" FOREIGN KEY ("stock_lock_id") REFERENCES "stock_block_mains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ecommerce_order_items" DROP COLUMN "stock_lock_id";
