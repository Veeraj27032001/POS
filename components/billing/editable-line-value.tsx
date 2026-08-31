"use client";

import { useEffect, useState } from "react";

// A number that looks like plain text until clicked, then edits in place —
// commits on blur or Enter, reverts on an invalid value. Used for a bill
// line's quantity and discount, both of which need to be editable directly
// in the table rather than only via re-scanning or a separate form.
export function EditableLineValue({
  value,
  onCommit,
  min = 0,
}: {
  value: number;
  onCommit: (next: number) => void;
  min?: number;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const next = Number(draft);
    if (!Number.isFinite(next) || next < min) {
      setDraft(String(value));
      return;
    }
    if (next !== value) onCommit(next);
  }

  return (
    <input
      type="number"
      min={min}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="border-input bg-background h-8 w-16 rounded border px-2 text-sm"
    />
  );
}
