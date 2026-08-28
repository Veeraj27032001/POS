-- AlterTable
ALTER TABLE "stock_negative_adjustment_mains" ADD COLUMN     "adjustment_date" DATE NOT NULL;

-- AlterTable
ALTER TABLE "stock_opening_mains" ADD COLUMN     "opening_date" DATE NOT NULL;

-- AlterTable
ALTER TABLE "stock_positive_adjustment_mains" ADD COLUMN     "adjustment_date" DATE NOT NULL;
