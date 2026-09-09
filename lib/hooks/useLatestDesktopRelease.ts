"use client";

import { useEffect, useState } from "react";

export interface LatestDesktopRelease {
  version: string;
  fileUrl: string;
}

// The most recently uploaded active desktop-app release, for the header
// download button — null until loaded, or if none has been uploaded yet.
export function useLatestDesktopRelease(): LatestDesktopRelease | null {
  const [release, setRelease] = useState<LatestDesktopRelease | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/desktop-releases")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: LatestDesktopRelease[] } | null) => {
        const latest = body?.data?.[0];
        if (!cancelled && latest) setRelease({ version: latest.version, fileUrl: latest.fileUrl });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return release;
}
