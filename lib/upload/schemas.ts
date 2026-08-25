import { z } from "zod";

export const completeUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(128),
  totalChunks: z.coerce.number().int().positive(),
});

export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
