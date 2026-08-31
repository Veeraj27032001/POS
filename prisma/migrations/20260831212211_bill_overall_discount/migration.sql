-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "discount_reason_code_id" TEXT,
ADD COLUMN     "overall_discount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_discount_reason_code_id_fkey" FOREIGN KEY ("discount_reason_code_id") REFERENCES "reason_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
