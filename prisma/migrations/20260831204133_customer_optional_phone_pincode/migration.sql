-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "pincode" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

