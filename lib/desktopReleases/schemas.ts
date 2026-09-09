import { z } from "zod";

import { optionalString, requiredString } from "@/lib/validation/common";

export const desktopReleaseCreateSchema = z.object({
  version: requiredString("Version", 32),
  fileUrl: requiredString("File URL", 2048),
  fileSizeBytes: z.coerce.number().int().positive(),
  releaseNotes: optionalString(2000),
});

export type DesktopReleaseCreateInput = z.infer<typeof desktopReleaseCreateSchema>;
