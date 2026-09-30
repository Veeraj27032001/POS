import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("text-muted-foreground flex items-center gap-2 text-sm", className)}
    >
      <Loader2Icon className="size-4 shrink-0 animate-spin" />
      {label}
    </div>
  );
}
