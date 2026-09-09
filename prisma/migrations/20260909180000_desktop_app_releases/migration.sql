-- CreateTable
CREATE TABLE "desktop_app_releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "release_notes" TEXT,
    "uploaded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "desktop_app_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "desktop_app_releases_version_key" ON "desktop_app_releases"("version");

-- AddForeignKey
ALTER TABLE "desktop_app_releases" ADD CONSTRAINT "desktop_app_releases_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
