ALTER TABLE "stores" ADD COLUMN     "code" TEXT;

UPDATE "stores" s
SET "code" = numbered.new_code
FROM (
  SELECT id, 'str' || ROW_NUMBER() OVER (ORDER BY created_at, id) AS new_code
  FROM "stores"
) AS numbered
WHERE s.id = numbered.id;

ALTER TABLE "stores" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "stores_code_key" ON "stores"("code");
