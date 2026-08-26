import { z } from "zod";

export const completeUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(128),
  totalChunks: z.coerce.number().int().positive(),
  // When set, the server finishes reassembly/storage and attaches the
  // resulting URL to the record itself, in the background — the caller
  // doesn't need to stay connected for that part to complete.
  attachTo: z
    .object({
      resource: z.literal("products"),
      id: z.string().min(1),
      field: z.enum(["images", "videos"]),
    })
    .optional(),
});

export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
