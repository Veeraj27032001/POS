"use client";

import { useState } from "react";

const STORAGE_KEY = "pos:selected-terminal";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// A terminal is tied to the physical checkout counter, not the logged-in
// user — persisted per-browser via localStorage so it's picked once (at
// login, or on the billing screen) and remembered on that device, the same
// convention as the toast-position preference. Read synchronously (lazy
// initializer) rather than in an effect, so there's no render where the
// remembered value looks unset yet.
export function useSelectedTerminal() {
  const [terminalId, setTerminalIdState] = useState<string | null>(() => readStored());

  function setTerminalId(id: string | null) {
    setTerminalIdState(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures — the in-memory value still works for this tab.
    }
  }

  return { terminalId, setTerminalId };
}
