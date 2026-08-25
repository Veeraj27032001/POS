"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const TOAST_POSITIONS = [
  "top-right",
  "top-left",
  "top-center",
  "bottom-right",
  "bottom-left",
  "bottom-center",
] as const;

export type ToastPosition = (typeof TOAST_POSITIONS)[number];

export const DEFAULT_TOAST_POSITION: ToastPosition = "top-right";

const STORAGE_KEY = "pos:toast-position";

function isToastPosition(value: unknown): value is ToastPosition {
  return typeof value === "string" && (TOAST_POSITIONS as readonly string[]).includes(value);
}

interface ToastPositionContextValue {
  position: ToastPosition;
  setPosition: (position: ToastPosition) => void;
}

const ToastPositionContext = createContext<ToastPositionContextValue | null>(null);

export function ToastPositionProvider({ children }: { children: ReactNode }) {
  const [position, setPositionState] = useState<ToastPosition>(DEFAULT_TOAST_POSITION);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isToastPosition(stored)) setPositionState(stored);
  }, []);

  function setPosition(next: ToastPosition) {
    setPositionState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <ToastPositionContext.Provider value={{ position, setPosition }}>
      {children}
    </ToastPositionContext.Provider>
  );
}

export function useToastPosition() {
  const ctx = useContext(ToastPositionContext);
  if (!ctx) throw new Error("useToastPosition must be used within a ToastPositionProvider");
  return ctx;
}
