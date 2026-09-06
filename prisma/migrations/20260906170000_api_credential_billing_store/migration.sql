-- Add the new column nullable first so existing rows can be backfilled.
ALTER TABLE "api_credentials" ADD COLUMN "billing_store_id" TEXT;

-- CreateTable (the new flat stores-set join table)
CREATE TABLE "_ApiCredentialStores" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ApiCredentialStores_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ApiCredentialStores_B_index" ON "_ApiCredentialStores"("B");

-- AddForeignKey
ALTER TABLE "_ApiCredentialStores" ADD CONSTRAINT "_ApiCredentialStores_A_fkey" FOREIGN KEY ("A") REFERENCES "api_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ApiCredentialStores" ADD CONSTRAINT "_ApiCredentialStores_B_fkey" FOREIGN KEY ("B") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: the old single store_id becomes the billing store...
UPDATE "api_credentials" SET "billing_store_id" = "store_id";

-- ...and also a member of the new flat stores set, so nothing existing
-- loses its store association.
INSERT INTO "_ApiCredentialStores" ("A", "B")
SELECT "id", "store_id" FROM "api_credentials" WHERE "store_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- DropForeignKey
ALTER TABLE "_ApiCredentialFulfilmentStores" DROP CONSTRAINT "_ApiCredentialFulfilmentStores_A_fkey";
ALTER TABLE "_ApiCredentialFulfilmentStores" DROP CONSTRAINT "_ApiCredentialFulfilmentStores_B_fkey";
ALTER TABLE "api_credentials" DROP CONSTRAINT "api_credentials_store_id_fkey";

-- AlterTable
ALTER TABLE "api_credentials" DROP COLUMN "multi_store_enabled",
DROP COLUMN "store_id",
ALTER COLUMN "billing_store_id" SET NOT NULL;

-- DropTable
DROP TABLE "_ApiCredentialFulfilmentStores";

-- AddForeignKey
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_billing_store_id_fkey" FOREIGN KEY ("billing_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
