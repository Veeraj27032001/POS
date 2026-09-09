"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { UploadReleaseDialog } from "@/components/desktop-app/upload-release-dialog";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { formatTimestamp } from "@/lib/datetime";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";

interface DesktopReleaseRow {
  id: string;
  version: string;
  fileUrl: string;
  fileSizeBytes: number;
  releaseNotes: string | null;
  createdAt: string;
  isActive: boolean;
  uploadedBy: { name: string } | null;
}

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DesktopAppPage() {
  const { data } = useSession();
  const session = asAppSession(data ?? null);
  const canManage = hasPermission(session?.user.permissions ?? [], "desktop_releases", "create");

  const [releases, setReleases] = useState<DesktopReleaseRow[] | undefined>(undefined);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  const load = useCallback(() => {
    fetch("/api/desktop-releases")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body: { data: DesktopReleaseRow[] }) => setReleases(body.data));
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
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Desktop App</h1>
          <p className="text-muted-foreground text-sm">
            Download the till/terminal software, or browse past versions.
          </p>
        </div>
        {canManage && <UploadReleaseDialog onUploaded={load} />}
      </div>

      {releases === undefined && <p className="text-muted-foreground text-sm">Loading…</p>}
      {releases?.length === 0 && (
        <p className="text-muted-foreground text-sm">No versions uploaded yet.</p>
      )}

      {releases && releases.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Version</th>
                <th className="p-3 font-medium">Uploaded</th>
                <th className="p-3 font-medium">By</th>
                <th className="p-3 font-medium">Size</th>
                <th className="p-3 font-medium">Notes</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.version}</td>
                  <td className="text-muted-foreground p-3">{formatTimestamp(r.createdAt)}</td>
                  <td className="text-muted-foreground p-3">{r.uploadedBy?.name ?? "—"}</td>
                  <td className="text-muted-foreground p-3">{formatFileSize(r.fileSizeBytes)}</td>
                  <td className="text-muted-foreground max-w-xs truncate p-3">
                    {r.releaseNotes ?? "—"}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        data-kbd-item=""
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
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
