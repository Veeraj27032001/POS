"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { uploadFile } from "./uploadFile";
import type { UploadFileOptions } from "./uploadFile";

export type UploadPhase = "idle" | "uploading" | "processing";

export interface UseFileUploadResult {
  upload: (file: File, attachTo?: UploadFileOptions["attachTo"]) => Promise<string | null>;
  progress: number;
  phase: UploadPhase;
  isUploading: boolean;
  error: string | null;
}

export function useFileUpload(): UseFileUploadResult {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const phaseRef = useRef<UploadPhase>("idle");

  // Only block leaving while chunks are still going out — once every byte
  // has reached the server, the merge is the backend's job and finishes
  // independently of this tab, so there's nothing left to protect.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (phaseRef.current !== "uploading") return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const upload = useCallback(async (file: File, attachTo?: UploadFileOptions["attachTo"]) => {
    phaseRef.current = "uploading";
    setPhase("uploading");
    setError(null);
    setProgress(0);
    try {
      const { url } = await uploadFile(file, {
        onProgress: setProgress,
        onProcessingStart: () => {
          phaseRef.current = "processing";
          setPhase("processing");
        },
        attachTo,
      });
      return url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      return null;
    } finally {
      phaseRef.current = "idle";
      setPhase("idle");
    }
  }, []);

  return { upload, progress, phase, isUploading: phase !== "idle", error };
}
