"use client";

import { ArrowDownIcon, ArrowUpIcon, Loader2Icon, VideoIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { deleteUploadedFile, useFileUpload, useSmoothedProgress } from "@/lib/upload";

export interface ProductMediaManagerProps {
  productId: string;
  images: string[];
  videos: string[];
  onUpdated: (next: { images: string[]; videos: string[] }) => void;
}

const POLL_INTERVAL_MS = 2000;

interface PendingMediaRow {
  id: string;
  field: "images" | "videos";
}

export function ProductMediaManager({
  productId,
  images,
  videos,
  onUpdated,
}: ProductMediaManagerProps) {
  const imageUpload = useFileUpload();
  const videoUpload = useFileUpload();
  const imageDisplayProgress = useSmoothedProgress(imageUpload.progress);
  const videoDisplayProgress = useSmoothedProgress(videoUpload.progress);
  const [pendingImages, setPendingImages] = useState(0);
  const [pendingVideos, setPendingVideos] = useState(0);
  const pollingRef = useRef(false);

  async function persist(next: { images: string[]; videos: string[] }): Promise<boolean> {
    const res = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save media.");
      return false;
    }
    onUpdated(next);
    return true;
  }

  // Removes the file from storage too, once it's no longer referenced —
  // otherwise it just sits there forever, still costing storage.
  async function deleteFromStorage(url: string) {
    try {
      await deleteUploadedFile(url);
    } catch {
      toast.error("Removed from the product, but failed to delete the file from storage.");
    }
  }

  // The server tracks "still processing" in the database (PendingMediaUpload
  // — see /api/uploads/[id]/complete and /api/products/[id]/pending-media),
  // not in this browser's local state, so it's the same answer no matter
  // which device or tab checks: a refresh, or opening the product on a
  // different device entirely, both see the real, current status.
  //
  // This polls that endpoint to reflect it live while the user is here, and
  // always does one product refetch on the tick where the pending list is
  // found empty — not only when a prior tick had seen it non-empty. A
  // background attach can finish (and its pending row get deleted) before
  // this loop's very first check runs, especially for a small file, so
  // "was it ever seen pending" is not a safe signal that nothing changed;
  // re-checking the product itself on every terminating tick is. Runs on
  // mount too, so a page load — including right after a refresh — picks up
  // whatever finished while nobody was watching.
  async function pollUntilClear() {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      for (;;) {
        const res = await fetch(`/api/products/${productId}/pending-media`);
        const rows: PendingMediaRow[] = res.ok ? (await res.json()).pending : [];
        const imageCount = rows.filter((r) => r.field === "images").length;
        const videoCount = rows.filter((r) => r.field === "videos").length;
        setPendingImages(imageCount);
        setPendingVideos(videoCount);

        if (imageCount === 0 && videoCount === 0) {
          const productRes = await fetch(`/api/products/${productId}`);
          if (productRes.ok) {
            const fresh = (await productRes.json()) as { images: string[]; videos: string[] };
            onUpdated({ images: fresh.images, videos: fresh.videos });
          }
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } finally {
      pollingRef.current = false;
    }
  }

  useEffect(() => {
    void pollUntilClear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function handleAddImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await imageUpload.upload(file, { resource: "products", id: productId, field: "images" });
    void pollUntilClear();
  }

  async function handleRemoveImage(index: number) {
    if (!window.confirm("Remove this image? It will be permanently deleted, not just unlinked.")) {
      return;
    }
    const url = images[index];
    const ok = await persist({ images: images.filter((_, i) => i !== index), videos });
    if (ok) await deleteFromStorage(url);
  }

  function handleMoveImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    persist({ images: next, videos });
  }

  async function handleAddVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await videoUpload.upload(file, { resource: "products", id: productId, field: "videos" });
    void pollUntilClear();
  }

  async function handleRemoveVideo(index: number) {
    if (!window.confirm("Remove this video? It will be permanently deleted, not just unlinked.")) {
      return;
    }
    const url = videos[index];
    const ok = await persist({ images, videos: videos.filter((_, i) => i !== index) });
    if (ok) await deleteFromStorage(url);
  }

  function handleMoveVideo(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= videos.length) return;
    const next = [...videos];
    [next[index], next[target]] = [next[target], next[index]];
    persist({ images, videos: next });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium">
          Images{" "}
          {images.length > 0 && <span className="text-muted-foreground">({images.length})</span>}
          {pendingImages > 0 && (
            <span className="text-muted-foreground ml-2 inline-flex items-center gap-1 text-xs font-normal">
              <Loader2Icon className="size-3 animate-spin" />
              {pendingImages} processing…
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="w-28 overflow-hidden rounded-lg border">
              <div className="bg-secondary relative h-24 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="size-full object-cover" />
                {index === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Cover
                  </span>
                )}
              </div>
              <div className="bg-muted/50 flex items-center justify-between gap-0.5 border-t px-1 py-1">
                <button
                  type="button"
                  onClick={() => handleMoveImage(index, -1)}
                  disabled={index === 0}
                  className="hover:bg-muted rounded p-1.5 disabled:opacity-30"
                  title="Move earlier"
                  aria-label="Move earlier"
                >
                  <ArrowUpIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveImage(index, 1)}
                  disabled={index === images.length - 1}
                  className="hover:bg-muted rounded p-1.5 disabled:opacity-30"
                  title="Move later"
                  aria-label="Move later"
                >
                  <ArrowDownIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="hover:bg-destructive/10 text-destructive rounded p-1.5"
                  title="Remove image"
                  aria-label="Remove image"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
          <label className="text-muted-foreground hover:text-foreground hover:border-foreground/30 flex h-24 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-1 text-center">
            {imageUpload.isUploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <span className="text-2xl leading-none">+</span>
            )}
            <span className="text-[11px]">
              {imageUpload.phase === "processing"
                ? "Processing…"
                : imageUpload.phase === "uploading"
                  ? `Uploading… ${Math.round(imageDisplayProgress * 100)}%`
                  : "Add image"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAddImage}
              disabled={imageUpload.isUploading}
            />
          </label>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          Videos{" "}
          {videos.length > 0 && <span className="text-muted-foreground">({videos.length})</span>}
          {pendingVideos > 0 && (
            <span className="text-muted-foreground ml-2 inline-flex items-center gap-1 text-xs font-normal">
              <Loader2Icon className="size-3 animate-spin" />
              {pendingVideos} processing…
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          {videos.map((url, index) => (
            <div key={`${url}-${index}`} className="w-48 overflow-hidden rounded-lg border">
              <video src={url} controls className="h-28 w-full bg-black object-cover" />
              <div className="bg-muted/50 flex items-center justify-between gap-0.5 border-t px-1 py-1">
                <button
                  type="button"
                  onClick={() => handleMoveVideo(index, -1)}
                  disabled={index === 0}
                  className="hover:bg-muted rounded p-1.5 disabled:opacity-30"
                  title="Move earlier"
                  aria-label="Move earlier"
                >
                  <ArrowUpIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveVideo(index, 1)}
                  disabled={index === videos.length - 1}
                  className="hover:bg-muted rounded p-1.5 disabled:opacity-30"
                  title="Move later"
                  aria-label="Move later"
                >
                  <ArrowDownIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveVideo(index)}
                  className="hover:bg-destructive/10 text-destructive rounded p-1.5"
                  title="Remove video"
                  aria-label="Remove video"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
          <label className="text-muted-foreground hover:text-foreground hover:border-foreground/30 flex h-28 w-48 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-1 text-center">
            {videoUpload.isUploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <VideoIcon className="size-4" />
            )}
            <span className="text-[11px]">
              {videoUpload.phase === "processing"
                ? "Processing…"
                : videoUpload.phase === "uploading"
                  ? `Uploading… ${Math.round(videoDisplayProgress * 100)}%`
                  : "Add video"}
            </span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleAddVideo}
              disabled={videoUpload.isUploading}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
