"use client";

import { useEffect, useState } from "react";

export interface LatestDesktopRelease {
  version: string;
  fileUrl: string;
  isActive: boolean;
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
        const latest = body?.data?.find((r) => r.isActive);
        if (!cancelled && latest)
          setRelease({ version: latest.version, fileUrl: latest.fileUrl, isActive: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return release;
}
