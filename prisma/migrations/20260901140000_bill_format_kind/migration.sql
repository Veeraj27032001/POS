-- CreateEnum
CREATE TYPE "BillFormatKind" AS ENUM ('receipt', 'bill');

-- AlterTable
ALTER TABLE "bill_formats" ADD COLUMN     "format_kind" "BillFormatKind" NOT NULL DEFAULT 'bill';
ALTER TABLE "bill_formats" ALTER COLUMN "format_kind" DROP DEFAULT;
