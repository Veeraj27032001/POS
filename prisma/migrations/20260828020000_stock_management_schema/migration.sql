-- CreateEnum
CREATE TYPE "StockBlockSourceType" AS ENUM ('manual', 'pending_transfer', 'draft_bill_line', 'ecommerce_order');

-- CreateEnum
CREATE TYPE "StockBlockItemStatus" AS ENUM ('active', 'released');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "StockExpirySourceItemType" AS ENUM ('stock_inward_item', 'stock_transfer_item', 'stock_positive_adjustment_item', 'stock_opening_item');

-- CreateEnum
CREATE TYPE "StockCorrectionSourceType" AS ENUM ('stock_inward_item', 'stock_damage_item', 'stock_positive_adjustment_item', 'stock_negative_adjustment_item', 'stock_opening_item');

-- CreateEnum
CREATE TYPE "ProductRequestStatus" AS ENUM ('draft', 'sent', 'partially_received', 'received', 'cancelled');

-- CreateTable
CREATE TABLE "stock_inward_mains" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "purchase_order_id" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_inward_mains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_inward_items" (
    "id" TEXT NOT NULL,
    "stock_inward_main_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity_accepted" INTEGER NOT NULL,
    "quantity_rejected" INTEGER,
    "expiry_date" DATE,
    "expiry_invalidated" BOOLEAN NOT NULL DEFAULT false,
    "expiry_invalidated_by_user_id" TEXT,
    "expiry_invalidated_at" TIMESTAMP(3),
    "unit_cost" DECIMAL(12,2),

    CONSTRAINT "stock_inward_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_damage_mains" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_damage_mains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_damage_items" (
    "id" TEXT NOT NULL,
    "stock_damage_main_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason_code_id" TEXT NOT NULL,

    CONSTRAINT "stock_damage_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_block_mains" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "source_type" "StockBlockSourceType" NOT NULL DEFAULT 'manual',
    "source_id" TEXT,
    "review_by_date" DATE,
    "blocked_by_user_id" TEXT NOT NULL,
    "blocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_block_mains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_block_items" (
    "id" TEXT NOT NULL,
    "stock_block_main_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity_blocked" INTEGER NOT NULL,
    "reason_code_id" TEXT NOT NULL,
    "status" "StockBlockItemStatus" NOT NULL DEFAULT 'active',
    "released_by_user_id" TEXT,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "stock_block_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_mains" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "source_warehouse_id" TEXT NOT NULL,
    "destination_warehouse_id" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'pending',
    "requested_by_user_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_by_user_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "stock_transfer_mains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_items" (
    "id" TEXT NOT NULL,
    "stock_transfer_main_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantity_accepted" INTEGER,
    "quantity_rejected" INTEGER,
    "expiry_date" DATE,
    "expiry_invalidated" BOOLEAN NOT NULL DEFAULT false,
    "expiry_invalidated_by_user_id" TEXT,
    "expiry_invalidated_at" TIMESTAMP(3),

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_positive_adjustment_mains" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_positive_adjustment_mains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_positive_adjustment_items" (
    "id" TEXT NOT NULL,
    "stock_positive_adjustment_main_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiry_date" DATE,
    "expiry_invalidated" BOOLEAN NOT NULL DEFAULT false,
    "expiry_invalidated_by_user_id" TEXT,
    "expiry_invalidated_at" TIMESTAMP(3),
    "reason_code_id" TEXT NOT NULL,

    CONSTRAINT "stock_positive_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opening_mains" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_opening_mains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opening_items" (
    "id" TEXT NOT NULL,
    "stock_opening_main_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiry_date" DATE,
    "expiry_invalidated" BOOLEAN NOT NULL DEFAULT false,
    "expiry_invalidated_by_user_id" TEXT,
    "expiry_invalidated_at" TIMESTAMP(3),

    CONSTRAINT "stock_opening_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_expiry_extensions" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "source_item_type" "StockExpirySourceItemType" NOT NULL,
    "source_item_id" TEXT NOT NULL,
    "previous_expiry_date" DATE NOT NULL,
    "new_expiry_date" DATE NOT NULL,
    "was_already_expired" BOOLEAN NOT NULL,
    "notes" TEXT,
    "extended_by_user_id" TEXT NOT NULL,
    "extended_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_expiry_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_negative_adjustment_mains" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_negative_adjustment_mains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_negative_adjustment_items" (
    "id" TEXT NOT NULL,
    "stock_negative_adjustment_main_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason_code_id" TEXT NOT NULL,

    CONSTRAINT "stock_negative_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_entry_corrections" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "source_item_type" "StockCorrectionSourceType" NOT NULL,
    "source_item_id" TEXT NOT NULL,
    "field_corrected" TEXT NOT NULL,
    "previous_value" INTEGER NOT NULL,
    "new_value" INTEGER NOT NULL,
    "notes" TEXT,
    "corrected_by_user_id" TEXT NOT NULL,
    "corrected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_entry_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_retest_mains" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_retest_mains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_retest_items" (
    "id" TEXT NOT NULL,
    "stock_retest_main_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity_tested" INTEGER NOT NULL,
    "quantity_passed" INTEGER NOT NULL,
    "quantity_failed" INTEGER NOT NULL,
    "notes" TEXT,
    "damage_item_id" TEXT,

    CONSTRAINT "stock_retest_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_request_mains" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "request_date" DATE NOT NULL,
    "status" "ProductRequestStatus" NOT NULL DEFAULT 'draft',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_request_mains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_request_items" (
    "id" TEXT NOT NULL,
    "product_request_main_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity_requested" INTEGER NOT NULL,
    "quantity_received" INTEGER NOT NULL DEFAULT 0,
    "expected_unit_cost" DECIMAL(12,2),

    CONSTRAINT "product_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_retest_items_damage_item_id_key" ON "stock_retest_items"("damage_item_id");

-- AddForeignKey
ALTER TABLE "stock_inward_mains" ADD CONSTRAINT "stock_inward_mains_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inward_mains" ADD CONSTRAINT "stock_inward_mains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inward_mains" ADD CONSTRAINT "stock_inward_mains_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inward_mains" ADD CONSTRAINT "stock_inward_mains_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inward_mains" ADD CONSTRAINT "stock_inward_mains_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "product_request_mains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inward_mains" ADD CONSTRAINT "stock_inward_mains_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inward_items" ADD CONSTRAINT "stock_inward_items_stock_inward_main_id_fkey" FOREIGN KEY ("stock_inward_main_id") REFERENCES "stock_inward_mains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inward_items" ADD CONSTRAINT "stock_inward_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inward_items" ADD CONSTRAINT "stock_inward_items_expiry_invalidated_by_user_id_fkey" FOREIGN KEY ("expiry_invalidated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_damage_mains" ADD CONSTRAINT "stock_damage_mains_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_damage_mains" ADD CONSTRAINT "stock_damage_mains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_damage_mains" ADD CONSTRAINT "stock_damage_mains_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_damage_mains" ADD CONSTRAINT "stock_damage_mains_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_damage_items" ADD CONSTRAINT "stock_damage_items_stock_damage_main_id_fkey" FOREIGN KEY ("stock_damage_main_id") REFERENCES "stock_damage_mains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_damage_items" ADD CONSTRAINT "stock_damage_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_damage_items" ADD CONSTRAINT "stock_damage_items_reason_code_id_fkey" FOREIGN KEY ("reason_code_id") REFERENCES "reason_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_block_mains" ADD CONSTRAINT "stock_block_mains_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_block_mains" ADD CONSTRAINT "stock_block_mains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_block_mains" ADD CONSTRAINT "stock_block_mains_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_block_mains" ADD CONSTRAINT "stock_block_mains_blocked_by_user_id_fkey" FOREIGN KEY ("blocked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_block_items" ADD CONSTRAINT "stock_block_items_stock_block_main_id_fkey" FOREIGN KEY ("stock_block_main_id") REFERENCES "stock_block_mains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_block_items" ADD CONSTRAINT "stock_block_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_block_items" ADD CONSTRAINT "stock_block_items_reason_code_id_fkey" FOREIGN KEY ("reason_code_id") REFERENCES "reason_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_block_items" ADD CONSTRAINT "stock_block_items_released_by_user_id_fkey" FOREIGN KEY ("released_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_mains" ADD CONSTRAINT "stock_transfer_mains_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_mains" ADD CONSTRAINT "stock_transfer_mains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_mains" ADD CONSTRAINT "stock_transfer_mains_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_mains" ADD CONSTRAINT "stock_transfer_mains_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_mains" ADD CONSTRAINT "stock_transfer_mains_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_mains" ADD CONSTRAINT "stock_transfer_mains_responded_by_user_id_fkey" FOREIGN KEY ("responded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_stock_transfer_main_id_fkey" FOREIGN KEY ("stock_transfer_main_id") REFERENCES "stock_transfer_mains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_expiry_invalidated_by_user_id_fkey" FOREIGN KEY ("expiry_invalidated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_positive_adjustment_mains" ADD CONSTRAINT "stock_positive_adjustment_mains_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_positive_adjustment_mains" ADD CONSTRAINT "stock_positive_adjustment_mains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_positive_adjustment_mains" ADD CONSTRAINT "stock_positive_adjustment_mains_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_positive_adjustment_mains" ADD CONSTRAINT "stock_positive_adjustment_mains_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_positive_adjustment_items" ADD CONSTRAINT "stock_positive_adjustment_items_stock_positive_adjustment__fkey" FOREIGN KEY ("stock_positive_adjustment_main_id") REFERENCES "stock_positive_adjustment_mains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_positive_adjustment_items" ADD CONSTRAINT "stock_positive_adjustment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_positive_adjustment_items" ADD CONSTRAINT "stock_positive_adjustment_items_expiry_invalidated_by_user_fkey" FOREIGN KEY ("expiry_invalidated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_positive_adjustment_items" ADD CONSTRAINT "stock_positive_adjustment_items_reason_code_id_fkey" FOREIGN KEY ("reason_code_id") REFERENCES "reason_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opening_mains" ADD CONSTRAINT "stock_opening_mains_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opening_mains" ADD CONSTRAINT "stock_opening_mains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opening_mains" ADD CONSTRAINT "stock_opening_mains_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opening_mains" ADD CONSTRAINT "stock_opening_mains_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opening_items" ADD CONSTRAINT "stock_opening_items_stock_opening_main_id_fkey" FOREIGN KEY ("stock_opening_main_id") REFERENCES "stock_opening_mains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opening_items" ADD CONSTRAINT "stock_opening_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opening_items" ADD CONSTRAINT "stock_opening_items_expiry_invalidated_by_user_id_fkey" FOREIGN KEY ("expiry_invalidated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_expiry_extensions" ADD CONSTRAINT "stock_expiry_extensions_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_expiry_extensions" ADD CONSTRAINT "stock_expiry_extensions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_expiry_extensions" ADD CONSTRAINT "stock_expiry_extensions_extended_by_user_id_fkey" FOREIGN KEY ("extended_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_negative_adjustment_mains" ADD CONSTRAINT "stock_negative_adjustment_mains_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_negative_adjustment_mains" ADD CONSTRAINT "stock_negative_adjustment_mains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_negative_adjustment_mains" ADD CONSTRAINT "stock_negative_adjustment_mains_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_negative_adjustment_mains" ADD CONSTRAINT "stock_negative_adjustment_mains_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_negative_adjustment_items" ADD CONSTRAINT "stock_negative_adjustment_items_stock_negative_adjustment__fkey" FOREIGN KEY ("stock_negative_adjustment_main_id") REFERENCES "stock_negative_adjustment_mains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_negative_adjustment_items" ADD CONSTRAINT "stock_negative_adjustment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_negative_adjustment_items" ADD CONSTRAINT "stock_negative_adjustment_items_reason_code_id_fkey" FOREIGN KEY ("reason_code_id") REFERENCES "reason_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entry_corrections" ADD CONSTRAINT "stock_entry_corrections_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entry_corrections" ADD CONSTRAINT "stock_entry_corrections_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_entry_corrections" ADD CONSTRAINT "stock_entry_corrections_corrected_by_user_id_fkey" FOREIGN KEY ("corrected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_retest_mains" ADD CONSTRAINT "stock_retest_mains_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_retest_mains" ADD CONSTRAINT "stock_retest_mains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_retest_mains" ADD CONSTRAINT "stock_retest_mains_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_retest_mains" ADD CONSTRAINT "stock_retest_mains_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_retest_items" ADD CONSTRAINT "stock_retest_items_stock_retest_main_id_fkey" FOREIGN KEY ("stock_retest_main_id") REFERENCES "stock_retest_mains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_retest_items" ADD CONSTRAINT "stock_retest_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_retest_items" ADD CONSTRAINT "stock_retest_items_damage_item_id_fkey" FOREIGN KEY ("damage_item_id") REFERENCES "stock_damage_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_mains" ADD CONSTRAINT "product_request_mains_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_mains" ADD CONSTRAINT "product_request_mains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_mains" ADD CONSTRAINT "product_request_mains_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_mains" ADD CONSTRAINT "product_request_mains_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_mains" ADD CONSTRAINT "product_request_mains_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_items" ADD CONSTRAINT "product_request_items_product_request_main_id_fkey" FOREIGN KEY ("product_request_main_id") REFERENCES "product_request_mains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request_items" ADD CONSTRAINT "product_request_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

