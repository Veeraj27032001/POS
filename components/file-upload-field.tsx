"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { useFileUpload } from "@/lib/upload";

export interface FileUploadFieldProps {
  value: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
}

export function FileUploadField({ value, onChange, accept }: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, progress, isUploading, error } = useFileUpload();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) onChange(url);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      {value && (
        <div className="flex items-center gap-2 text-sm">
          <a href={value} target="_blank" rel="noreferrer" className="truncate underline">
            {value}
          </a>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={isUploading}
        onChange={handleFileChange}
        className="text-sm"
      />

      {isUploading && (
        <div className="bg-muted relative h-1 w-full overflow-hidden rounded">
          <div
            className="bg-primary absolute inset-y-0 left-0 transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
