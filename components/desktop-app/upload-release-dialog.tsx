"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFormActions,
  DialogFormBody,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { uploadFile } from "@/lib/upload";

export interface UploadReleaseDialogProps {
  onUploaded: () => void;
}

export function UploadReleaseDialog({ onUploaded }: UploadReleaseDialogProps) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "saving">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kbdRef = useArrowKeyNav<HTMLFormElement>({ selector: "[data-kbd-item]" });

  const busy = phase !== "idle";

  function reset() {
    setVersion("");
    setReleaseNotes("");
    setFile(null);
    setProgress(0);
    setPhase("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Choose an installer file.");
      return;
    }

    setPhase("uploading");
    try {
      const { url } = await uploadFile(file, {
        sizeLimitKind: "desktop-release",
        onProgress: setProgress,
        onProcessingStart: () => setPhase("processing"),
      });
      if (!url) {
        toast.error("Upload failed.");
        setPhase("idle");
        return;
      }

      setPhase("saving");
      const res = await fetch("/api/desktop-releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version,
          releaseNotes: releaseNotes || undefined,
          fileUrl: url,
          fileSizeBytes: file.size,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to save the release.");
        return;
      }

      toast.success("Release uploaded.");
      setOpen(false);
      reset();
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPhase("idle");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button data-kbd-item="">Upload new version</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Desktop App Release</DialogTitle>
        </DialogHeader>
        <form
          ref={kbdRef}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogFormBody>
            <div className="space-y-1.5">
              <Label htmlFor="release-version">Version</Label>
              <Input
                id="release-version"
                data-kbd-item=""
                placeholder="e.g. 0.1.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="release-notes">Release notes (optional)</Label>
              <Textarea
                id="release-notes"
                data-kbd-item=""
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="release-file">Installer file</Label>
              <input
                id="release-file"
                ref={fileInputRef}
                type="file"
                accept=".exe"
                data-kbd-item=""
                disabled={busy}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </div>

            {busy && (
              <div className="space-y-1">
                <div className="bg-muted relative h-1 w-full overflow-hidden rounded">
                  <div
                    className="bg-primary absolute inset-y-0 left-0 transition-all"
                    style={{
                      width: `${Math.round((phase === "uploading" ? progress : 1) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  {phase === "uploading" && `Uploading… ${Math.round(progress * 100)}%`}
                  {phase === "processing" && "Processing…"}
                  {phase === "saving" && "Saving…"}
                </p>
              </div>
            )}
          </DialogFormBody>

          <DialogFormActions>
            <Button type="submit" data-kbd-item="" disabled={busy}>
              {busy ? "Uploading…" : "Upload"}
            </Button>
          </DialogFormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
