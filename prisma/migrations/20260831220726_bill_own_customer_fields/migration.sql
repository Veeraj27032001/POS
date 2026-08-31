-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "customer_address" TEXT,
ADD COLUMN     "customer_country_id" TEXT,
ADD COLUMN     "customer_email" TEXT,
ADD COLUMN     "customer_name" TEXT,
ADD COLUMN     "customer_phone" TEXT,
ADD COLUMN     "customer_pincode" TEXT,
ADD COLUMN     "customer_state_id" TEXT;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_country_id_fkey" FOREIGN KEY ("customer_country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_state_id_fkey" FOREIGN KEY ("customer_state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;
