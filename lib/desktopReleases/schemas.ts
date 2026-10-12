import { z } from "zod";

import { optionalString, requiredString } from "@/lib/validation/common";

export const appPlatformSchema = z.enum(["windows", "android"]);

export const desktopReleaseCreateSchema = z.object({
  platform: appPlatformSchema.default("windows"),
  version: requiredString("Version", 32),
  fileUrl: requiredString("File URL", 2048),
  fileSizeBytes: z.coerce.number().int().positive(),
  releaseNotes: optionalString(2000),
});

export type DesktopReleaseCreateInput = z.infer<typeof desktopReleaseCreateSchema>;
