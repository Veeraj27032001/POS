-- CreateEnum
CREATE TYPE "SeriesType" AS ENUM ('cash_bill', 'credit_bill', 'stock_inward', 'expiry_extension', 'credit_note', 'stock_damage', 'stock_block', 'stock_transfer', 'positive_adjustment', 'negative_adjustment', 'opening_balance', 'entry_correction', 'payment_request', 'refund', 'bill_cancellation', 'bill_return', 'bill_payment', 'shift', 'online_bill', 'stock_retest');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('cash', 'card', 'digital_wallet', 'bank_transfer', 'other');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percent', 'flat');

-- CreateEnum
CREATE TYPE "DiscountAppliesTo" AS ENUM ('product', 'category', 'all');

-- CreateEnum
CREATE TYPE "ReasonCodeCategory" AS ENUM ('return', 'void', 'discount', 'stock_adjustment', 'damage', 'stock_block');

-- CreateEnum
CREATE TYPE "DenominationType" AS ENUM ('note', 'coin');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_rights" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "role_rights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "tax_region_id" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "default_currency" TEXT NOT NULL DEFAULT 'INR',
    "gstin" TEXT,
    "logo_url" TEXT,
    "receipt_header_text" TEXT,
    "receipt_footer_text" TEXT,
    "return_policy_text" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_years" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numbering_series" (
    "id" TEXT NOT NULL,
    "series_type" "SeriesType" NOT NULL,
    "store_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "prefix" TEXT,
    "current_number" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "numbering_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "store_id" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "store_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_regions" (
    "id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tax_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_schemes" (
    "id" TEXT NOT NULL,
    "region_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_components" (
    "id" TEXT NOT NULL,
    "scheme_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate_percent" DECIMAL(12,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "tax_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_codes" (
    "id" TEXT NOT NULL,
    "scheme_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "component_group" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_category_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uoms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "base_uom_id" TEXT,
    "conversion_factor" DECIMAL(12,4),

    CONSTRAINT "uoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT,
    "tax_code_id" TEXT NOT NULL,
    "track_expiry" BOOLEAN NOT NULL DEFAULT false,
    "images" TEXT[],
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_label" TEXT NOT NULL,
    "pack_size" DECIMAL(10,3),
    "uom_id" TEXT NOT NULL,
    "sku_barcode" TEXT,
    "system_barcode" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "tax_code_id" TEXT,
    "stock_tracked" BOOLEAN NOT NULL DEFAULT true,
    "reorder_level" INTEGER,
    "default_cost_price" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "tax_id" TEXT,
    "credit_limit" DECIMAL(12,2),
    "loyalty_points" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "tax_id" TEXT,
    "payment_terms" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "store_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "requires_reference" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "store_id" TEXT,
    "effective_from" DATE,
    "effective_to" DATE,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "applies_to" "DiscountAppliesTo" NOT NULL,
    "product_id" TEXT,
    "category_id" TEXT,
    "coupon_code" TEXT,
    "effective_from" DATE,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminals" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "device_identifier" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reason_codes" (
    "id" TEXT NOT NULL,
    "category" "ReasonCodeCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "reason_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_denominations" (
    "id" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "type" "DenominationType" NOT NULL,
    "currency" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cash_denominations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rules" (
    "id" TEXT NOT NULL,
    "store_id" TEXT,
    "earn_rate" DECIMAL(12,4) NOT NULL,
    "redeem_rate" DECIMAL(12,4) NOT NULL,
    "min_redeem_points" INTEGER,
    "effective_from" DATE,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "loyalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_credentials" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "api_secret_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProductToSupplier" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductToSupplier_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_rights_role_id_module_action_key" ON "role_rights"("role_id", "module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "numbering_series_series_type_store_id_financial_year_id_key" ON "numbering_series"("series_type", "store_id", "financial_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_store_id_idx" ON "audit_logs"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_codes_scheme_id_code_key" ON "tax_codes"("scheme_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_barcode_key" ON "product_variants"("sku_barcode");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_system_barcode_key" ON "product_variants"("system_barcode");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_items_price_list_id_product_variant_id_key" ON "price_list_items"("price_list_id", "product_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "discounts_coupon_code_key" ON "discounts"("coupon_code");

-- CreateIndex
CREATE UNIQUE INDEX "api_credentials_api_key_key" ON "api_credentials"("api_key");

-- CreateIndex
CREATE INDEX "_ProductToSupplier_B_index" ON "_ProductToSupplier"("B");

-- AddForeignKey
ALTER TABLE "role_rights" ADD CONSTRAINT "role_rights_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_tax_region_id_fkey" FOREIGN KEY ("tax_region_id") REFERENCES "tax_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_series" ADD CONSTRAINT "numbering_series_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_series" ADD CONSTRAINT "numbering_series_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_schemes" ADD CONSTRAINT "tax_schemes_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "tax_regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_components" ADD CONSTRAINT "tax_components_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "tax_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "tax_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uoms" ADD CONSTRAINT "uoms_base_uom_id_fkey" FOREIGN KEY ("base_uom_id") REFERENCES "uoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rules" ADD CONSTRAINT "loyalty_rules_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToSupplier" ADD CONSTRAINT "_ProductToSupplier_A_fkey" FOREIGN KEY ("A") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToSupplier" ADD CONSTRAINT "_ProductToSupplier_B_fkey" FOREIGN KEY ("B") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
