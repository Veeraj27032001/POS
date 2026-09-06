-- AlterTable
ALTER TABLE "customers" DROP COLUMN "password_hash";

-- CreateTable
CREATE TABLE "ecommerce_customers" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ecommerce_customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ecommerce_customers_phone_key" ON "ecommerce_customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "ecommerce_customers_customer_id_key" ON "ecommerce_customers"("customer_id");

-- AddForeignKey
ALTER TABLE "ecommerce_customers" ADD CONSTRAINT "ecommerce_customers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
