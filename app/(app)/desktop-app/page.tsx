"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { UploadReleaseDialog } from "@/components/desktop-app/upload-release-dialog";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import type { AppPlatform } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { formatTimestamp } from "@/lib/datetime";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";

interface AppReleaseRow {
  id: string;
  platform: AppPlatform;
  version: string;
  fileUrl: string;
  fileSizeBytes: number;
  releaseNotes: string | null;
  createdAt: string;
  isActive: boolean;
  uploadedBy: { name: string } | null;
}

const PLATFORMS: { key: AppPlatform; title: string; blurb: string; empty: string }[] = [
  {
    key: "windows",
    title: "Windows desktop",
    blurb: "For a till or counter PC. Drives the receipt printer and cash drawer.",
    empty: "No Windows versions uploaded yet.",
  },
  {
    key: "android",
    title: "Android",
    blurb: "For a phone or handheld terminal. Install the APK directly on the device.",
    empty: "No Android versions uploaded yet.",
  },
];

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AppDownloadsPage() {
  const { data } = useSession();
  const session = asAppSession(data ?? null);
  const canManage = hasPermission(session?.user.permissions ?? [], "desktop_releases", "create");

  const [releases, setReleases] = useState<AppReleaseRow[] | undefined>(undefined);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  const load = useCallback(() => {
    fetch("/api/desktop-releases")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body: { data: AppReleaseRow[] }) => setReleases(body.data));
  }, []);

  useEffect(load, [load]);

  async function toggleActive(id: string) {
    const res = await fetch(`/api/desktop-releases/${id}`, { method: "PATCH" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to update.");
      return;
    }
    load();
  }

  return (
    <div ref={kbdRef} className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Apps</h1>
        <p className="text-muted-foreground text-sm">
          Download the till software for this store, or browse past versions.
        </p>
      </div>

      {releases === undefined && <LoadingState />}

      {releases !== undefined &&
        PLATFORMS.map(({ key, title, blurb, empty }) => {
          const rows = releases.filter((r) => r.platform === key);
          return (
            <section key={key} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{title}</h2>
                  <p className="text-muted-foreground text-sm">{blurb}</p>
                </div>
                {canManage && <UploadReleaseDialog platform={key} onUploaded={load} />}
              </div>

              {rows.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border p-4 text-sm">{empty}</p>
              ) : (
                <div className="divide-border divide-y overflow-hidden rounded-lg border">
                  {rows.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">
                          v{r.version}
                          {!r.isActive && (
                            <span className="text-muted-foreground ml-2 text-xs font-normal">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {formatTimestamp(r.createdAt)} · {formatFileSize(r.fileSizeBytes)} ·{" "}
                          {r.uploadedBy?.name ?? "—"}
                        </div>
                        {r.releaseNotes && (
                          <div className="text-muted-foreground mt-0.5 text-xs">
                            {r.releaseNotes}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          data-kbd-item=""
                          nativeButton={false}
                          render={<a href={r.fileUrl} download />}
                        >
                          Download
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            data-kbd-item=""
                            onClick={() => void toggleActive(r.id)}
                          >
                            {r.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

      {releases !== undefined && releases.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Android may warn about installing outside the Play Store — allow installs from this source
          to continue.
        </p>
      )}
    </div>
  );
}
