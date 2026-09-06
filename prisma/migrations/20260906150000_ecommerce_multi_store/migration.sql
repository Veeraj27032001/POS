-- AlterTable
ALTER TABLE "api_credentials" ADD COLUMN     "multi_store_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "split_orders_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "_ApiCredentialFulfilmentStores" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ApiCredentialFulfilmentStores_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ApiCredentialFulfilmentStores_B_index" ON "_ApiCredentialFulfilmentStores"("B");

-- AddForeignKey
ALTER TABLE "_ApiCredentialFulfilmentStores" ADD CONSTRAINT "_ApiCredentialFulfilmentStores_A_fkey" FOREIGN KEY ("A") REFERENCES "api_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApiCredentialFulfilmentStores" ADD CONSTRAINT "_ApiCredentialFulfilmentStores_B_fkey" FOREIGN KEY ("B") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
