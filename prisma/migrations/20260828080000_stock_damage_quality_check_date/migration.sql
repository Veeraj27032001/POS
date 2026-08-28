-- AlterTable
ALTER TABLE "stock_damage_mains" ADD COLUMN "damage_date" DATE;
UPDATE "stock_damage_mains" SET "damage_date" = "created_at"::date WHERE "damage_date" IS NULL;
ALTER TABLE "stock_damage_mains" ALTER COLUMN "damage_date" SET NOT NULL;

-- AlterTable
ALTER TABLE "stock_quality_check_mains" ADD COLUMN "check_date" DATE;
UPDATE "stock_quality_check_mains" SET "check_date" = "created_at"::date WHERE "check_date" IS NULL;
ALTER TABLE "stock_quality_check_mains" ALTER COLUMN "check_date" SET NOT NULL;
