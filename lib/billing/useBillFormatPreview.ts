"use client";

import { useState } from "react";
import { toast } from "sonner";

export function useBillFormatPreview() {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runPreview(formatKind: string, templateHtml: string): Promise<string | null> {
    if (!formatKind || !templateHtml) {
      toast.error("Select a type and enter template HTML first.");
      return null;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/bill-formats/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formatKind, templateHtml }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to render the preview.");
        return null;
      }
      const body = (await res.json()) as { html: string };
      setPreviewHtml(body.html);
      return body.html;
    } finally {
      setLoading(false);
    }
  }

  return { previewHtml, loading, runPreview };
}
