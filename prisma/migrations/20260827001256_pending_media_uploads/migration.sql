CREATE TABLE "pending_media_uploads" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_media_uploads_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pending_media_uploads" ADD CONSTRAINT "pending_media_uploads_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

