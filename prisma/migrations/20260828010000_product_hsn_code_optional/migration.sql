-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_hsn_code_id_fkey";

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "hsn_code_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_hsn_code_id_fkey" FOREIGN KEY ("hsn_code_id") REFERENCES "hsn_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
