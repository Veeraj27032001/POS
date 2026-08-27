-- CreateTable
CREATE TABLE "tax_preferences" (
    "id" TEXT NOT NULL,
    "hsn_tax_display_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_apply_tax_by_default" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_preferences_pkey" PRIMARY KEY ("id")
);
