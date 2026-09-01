-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "tax_excluded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "default_exclude_tax" BOOLEAN NOT NULL DEFAULT false;
