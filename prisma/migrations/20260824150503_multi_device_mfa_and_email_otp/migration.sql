CREATE TYPE "MfaMethod" AS ENUM ('totp', 'email_otp');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "mfa_enabled",
DROP COLUMN "mfa_secret",
ADD COLUMN     "mfa_method" "MfaMethod";

-- CreateTable
CREATE TABLE "mfa_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "mfa_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_otp_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_otp_challenges_user_id_idx" ON "email_otp_challenges"("user_id");

-- AddForeignKey
ALTER TABLE "mfa_devices" ADD CONSTRAINT "mfa_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_otp_challenges" ADD CONSTRAINT "email_otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

