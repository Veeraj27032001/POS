CREATE TYPE "AppPlatform" AS ENUM ('windows', 'android');

-- Everything released so far is the Windows desktop build.
ALTER TABLE "desktop_app_releases"
  ADD COLUMN     "platform" "AppPlatform" NOT NULL DEFAULT 'windows';

-- A version string is only unique within its own platform now.
DROP INDEX "desktop_app_releases_version_key";

CREATE UNIQUE INDEX "desktop_app_releases_platform_version_key"
  ON "desktop_app_releases"("platform", "version");
