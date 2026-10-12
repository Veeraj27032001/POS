"use client";

import { useEffect, useState } from "react";

export interface LatestDesktopRelease {
  version: string;
  fileUrl: string;
  isActive: boolean;
  platform?: string;
}

// The most recently uploaded active Windows release, for the header download
// button — null until loaded, or if none has been uploaded yet. The platform
// filter matters now that Android builds live in the same table: without it
// this would happily hand an APK to the desktop button.
export function useLatestDesktopRelease(): LatestDesktopRelease | null {
  const [release, setRelease] = useState<LatestDesktopRelease | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/desktop-releases")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: LatestDesktopRelease[] } | null) => {
        const latest = body?.data?.find((r) => r.isActive && r.platform !== "android");
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
