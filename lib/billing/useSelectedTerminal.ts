"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "pos:selected-terminal";

// A terminal is tied to the physical checkout counter, not the logged-in
// user — persisted per-browser via localStorage so it's picked once (at
// login, or on the billing screen) and remembered on that device, the same
// convention as the toast-position preference.
export function useSelectedTerminal() {
  const [terminalId, setTerminalIdState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setTerminalIdState(stored);
    } catch {
      // Private browsing / blocked storage — fall back to no remembered terminal.
    }
  }, []);

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
