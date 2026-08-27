-- Ensure every HSN code currently referenced by a product exists in
-- hsn_codes with a correct CGST/SGST/IGST split (half the real slab rate
-- each for intra-state, the full rate for inter-state) before Product is
-- repointed at it. Overwrites any placeholder rates a prior test/import
-- left behind for the same code.
INSERT INTO "hsn_codes" ("id", "hsn_code", "description", "cgst_rate", "sgst_rate", "igst_rate", "is_active", "is_deleted")
VALUES
  (gen_random_uuid(), '1905', 'Bread, biscuits, bakery products', 2.5, 2.5, 5, true, false),
  (gen_random_uuid(), '2106', 'Food preparations (snacks, namkeens)', 6, 6, 12, true, false),
  (gen_random_uuid(), '2202', 'Beverages, non-alcoholic', 9, 9, 18, true, false),
  (gen_random_uuid(), '3004', 'Medicaments', 6, 6, 12, true, false),
  (gen_random_uuid(), '3401', 'Soap, personal care', 9, 9, 18, true, false),
  (gen_random_uuid(), '6109', 'Apparel, knitted', 6, 6, 12, true, false),
  (gen_random_uuid(), '8517', 'Phones, communication equipment', 9, 9, 18, true, false),
  (gen_random_uuid(), '9503', 'Toys and games', 6, 6, 12, true, false)
ON CONFLICT ("hsn_code") DO UPDATE SET
  "description" = EXCLUDED."description",
  "cgst_rate" = EXCLUDED."cgst_rate",
  "sgst_rate" = EXCLUDED."sgst_rate",
  "igst_rate" = EXCLUDED."igst_rate";

-- Defensive: cover any tax_codes.code not in the known list above (e.g. one
-- created by hand through the old Tax Settings page) with a flat fallback
-- rate, so no product is left without a matching HSN code to backfill from.
INSERT INTO "hsn_codes" ("id", "hsn_code", "description", "cgst_rate", "sgst_rate", "igst_rate", "is_active", "is_deleted")
SELECT gen_random_uuid(), tc."code", tc."description", 9, 9, 18, true, false
FROM "tax_codes" tc
WHERE NOT EXISTS (SELECT 1 FROM "hsn_codes" hc WHERE hc."hsn_code" = tc."code")
ON CONFLICT ("hsn_code") DO NOTHING;

-- AlterTable: add the new column nullable first so existing product rows
-- can be backfilled before the NOT NULL constraint is enforced.
ALTER TABLE "products" ADD COLUMN "hsn_code_id" TEXT;

UPDATE "products" p
SET "hsn_code_id" = hc."id"
FROM "tax_codes" tc
JOIN "hsn_codes" hc ON hc."hsn_code" = tc."code"
WHERE p."tax_code_id" = tc."id";

ALTER TABLE "products" ALTER COLUMN "hsn_code_id" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_tax_code_id_fkey";

-- DropForeignKey
ALTER TABLE "stores" DROP CONSTRAINT "stores_tax_region_id_fkey";

-- DropForeignKey
ALTER TABLE "tax_codes" DROP CONSTRAINT "tax_codes_scheme_id_fkey";

-- DropForeignKey
ALTER TABLE "tax_components" DROP CONSTRAINT "tax_components_scheme_id_fkey";

-- DropForeignKey
ALTER TABLE "tax_schemes" DROP CONSTRAINT "tax_schemes_region_id_fkey";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "tax_code_id";

-- AlterTable
ALTER TABLE "stores" DROP COLUMN "tax_region_id";

-- DropTable
DROP TABLE "tax_codes";

-- DropTable
DROP TABLE "tax_components";

-- DropTable
DROP TABLE "tax_regions";

-- DropTable
DROP TABLE "tax_schemes";

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_hsn_code_id_fkey" FOREIGN KEY ("hsn_code_id") REFERENCES "hsn_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
