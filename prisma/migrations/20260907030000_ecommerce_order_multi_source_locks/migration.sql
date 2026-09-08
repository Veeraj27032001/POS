-- Structural changes only — nullable/additive so existing rows stay valid
-- until the follow-up backfill script + tightening migration run.

ALTER TABLE "terminals" ADD COLUMN     "is_system_generated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ecommerce_orders" ADD COLUMN     "api_credential_id" TEXT;

CREATE TABLE "ecommerce_order_item_locks" (
    "id" TEXT NOT NULL,
    "ecommerce_order_item_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "stock_lock_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ecommerce_order_item_locks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ecommerce_orders" ADD CONSTRAINT "ecommerce_orders_api_credential_id_fkey" FOREIGN KEY ("api_credential_id") REFERENCES "api_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ecommerce_order_item_locks" ADD CONSTRAINT "ecommerce_order_item_locks_ecommerce_order_item_id_fkey" FOREIGN KEY ("ecommerce_order_item_id") REFERENCES "ecommerce_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ecommerce_order_item_locks" ADD CONSTRAINT "ecommerce_order_item_locks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ecommerce_order_item_locks" ADD CONSTRAINT "ecommerce_order_item_locks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
