import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import { app, dialog, shell } from "electron";

import type { ElectronConfig } from "./config";

interface LatestReleaseResponse {
  version: string;
  fileUrl: string;
  releaseNotes: string | null;
}

// Simple numeric x.y.z compare — every version this app has ever used
// follows that shape, so full semver (pre-release tags, etc.) is more than
// this needs.
function isNewerVersion(remote: string, current: string): boolean {
  const r = remote.split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rv = r[i] ?? 0;
    const cv = c[i] ?? 0;
    if (rv > cv) return true;
    if (rv < cv) return false;
  }
  return false;
}

async function downloadInstaller(fileUrl: string, version: string): Promise<string> {
  const res = await fetch(fileUrl);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }
  const destPath = join(app.getPath("temp"), `POS-Setup-${version}.exe`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(destPath));
  return destPath;
}

// Only ever runs inside the packaged desktop app (this module has no
// browser-tab counterpart) — checks the same DesktopAppRelease table the
// web header's download button already reads, via a deliberately
// unauthenticated endpoint since this runs before any login exists.
export async function checkForUpdates(config: ElectronConfig): Promise<void> {
  let latest: LatestReleaseResponse;
  try {
    const res = await fetch(`${config.SERVER_URL}/api/desktop-releases/latest`);
    if (!res.ok) return;
    latest = (await res.json()) as LatestReleaseResponse;
  } catch {
    // Offline, server unreachable, etc. — silently skip; this is a
    // background check, not something that should ever interrupt launch.
    return;
  }

  const currentVersion = app.getVersion();
  if (!isNewerVersion(latest.version, currentVersion)) return;

  const { response } = await dialog.showMessageBox({
    type: "info",
    title: "Update available",
    message: `A new version (${latest.version}) is available. You're on ${currentVersion}.`,
    detail: latest.releaseNotes ?? undefined,
    buttons: ["Download && Install", "Later"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return;

  let installerPath: string;
  try {
    installerPath = await downloadInstaller(latest.fileUrl, latest.version);
  } catch (err) {
    await dialog.showMessageBox({
      type: "error",
      title: "Update failed",
      message: "Couldn't download the update.",
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  await dialog.showMessageBox({
    type: "info",
    title: "Ready to install",
    message: "The installer will now open. This app will close so it can update.",
  });

  await shell.openPath(installerPath);
  app.quit();
}
