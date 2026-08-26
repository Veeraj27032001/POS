"use client";

import { useCallback, useState } from "react";

import { uploadFile } from "./uploadFile";

export type UploadPhase = "idle" | "uploading" | "processing";

export interface UseFileUploadResult {
  upload: (file: File) => Promise<string | null>;
  progress: number;
  phase: UploadPhase;
  isUploading: boolean;
  error: string | null;
}

export function useFileUpload(): UseFileUploadResult {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    setPhase("uploading");
    setError(null);
    setProgress(0);
    try {
      const { url } = await uploadFile(file, {
        onProgress: setProgress,
        onProcessingStart: () => setPhase("processing"),
      });
      return url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      return null;
    } finally {
      setPhase("idle");
    }
  }, []);

  return { upload, progress, phase, isUploading: phase !== "idle", error };
}
