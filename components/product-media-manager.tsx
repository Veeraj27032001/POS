"use client";

import { ArrowDownIcon, ArrowUpIcon, Loader2Icon, VideoIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { useFileUpload } from "@/lib/upload";

export interface ProductMediaManagerProps {
  productId: string;
  images: string[];
  videos: string[];
  onUpdated: (next: { images: string[]; videos: string[] }) => void;
}

export function ProductMediaManager({
  productId,
  images,
  videos,
  onUpdated,
}: ProductMediaManagerProps) {
  const imageUpload = useFileUpload();
  const videoUpload = useFileUpload();

  async function persist(next: { images: string[]; videos: string[] }) {
    const res = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save media.");
      return;
    }
    onUpdated(next);
  }

  async function handleAddImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await imageUpload.upload(file);
    if (!url) return;
    await persist({ images: [...images, url], videos });
  }

  function handleRemoveImage(index: number) {
    persist({ images: images.filter((_, i) => i !== index), videos });
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
    const url = await videoUpload.upload(file);
    if (!url) return;
    await persist({ images, videos: [...videos, url] });
  }

  function handleRemoveVideo(index: number) {
    persist({ images, videos: videos.filter((_, i) => i !== index) });
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
          <label className="text-muted-foreground hover:text-foreground hover:border-foreground/30 flex h-24 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed">
            {imageUpload.isUploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <span className="text-2xl leading-none">+</span>
            )}
            <span className="text-[11px]">Add image</span>
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
          <label className="text-muted-foreground hover:text-foreground hover:border-foreground/30 flex h-28 w-48 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed">
            {videoUpload.isUploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <VideoIcon className="size-4" />
            )}
            <span className="text-[11px]">Add video</span>
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
