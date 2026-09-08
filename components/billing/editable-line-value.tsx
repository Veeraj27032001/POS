"use client";

import { useEffect, useState } from "react";

// A number that looks like plain text until clicked, then edits in place —
// commits on blur or Enter, reverts on an invalid value. Used for a bill
// line's quantity and discount, both of which need to be editable directly
// in the table rather than only via re-scanning or a separate form. `max`
// is advisory only — it still commits and lets the server (the real source
// of truth) reject it — just shows a warning on blur so the cashier doesn't
// have to wait for a round trip to find out.
export function EditableLineValue({
  value,
  onCommit,
  min = 0,
  max,
  maxMessage,
}: {
  value: number;
  onCommit: (next: number) => void;
  min?: number;
  max?: number;
  maxMessage?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    setDraft(String(value));
    setWarning(max !== undefined && value > max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit() {
    const next = Number(draft);
    if (!Number.isFinite(next) || next < min) {
      setDraft(String(value));
      setWarning(false);
      return;
    }
    setWarning(max !== undefined && next > max);
    if (next !== value) onCommit(next);
  }

  return (
    <div>
      <input
        type="number"
        min={min}
        data-kbd-item=""
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
      {warning && (
        <div className="text-warning text-xs whitespace-nowrap">
          {maxMessage ?? `Can't exceed ${max}.`}
        </div>
      )}
    </div>
  );
}
