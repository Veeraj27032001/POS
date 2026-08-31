"use client";

import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TOAST_POSITIONS, useToastPosition, type ToastPosition } from "@/lib/toast/toast-position";

const POSITION_LABELS: Record<ToastPosition, string> = {
  "top-right": "Top right",
  "top-left": "Top left",
  "top-center": "Top center",
  "bottom-right": "Bottom right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom center",
};

export default function PreferencesSettingsPage() {
  const { position, setPosition } = useToastPosition();

  function handleChange(next: ToastPosition | null) {
    if (!next) return;
    setPosition(next);
    toast.success("Notification position updated.");
  }

  return (
    <div className="space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Preferences</h1>

      <div className="max-w-md space-y-1.5">
        <Label>Notification position</Label>
        <Select
          value={position}
          onValueChange={handleChange}
          items={TOAST_POSITIONS.map((value) => ({ value, label: POSITION_LABELS[value] }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOAST_POSITIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {POSITION_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-sm">
          Controls where save success/error notifications appear on screen.
        </p>
      </div>
    </div>
  );
}
