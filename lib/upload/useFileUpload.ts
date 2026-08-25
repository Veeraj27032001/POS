"use client";

import { useCallback, useState } from "react";

import { uploadFile } from "./uploadFile";

export interface UseFileUploadResult {
  upload: (file: File) => Promise<string | null>;
  progress: number;
  isUploading: boolean;
  error: string | null;
}

export function useFileUpload(): UseFileUploadResult {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    setProgress(0);
    try {
      const { url } = await uploadFile(file, { onProgress: setProgress });
      return url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { upload, progress, isUploading, error };
}
