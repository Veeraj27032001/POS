"use client";

import { useCallback, useEffect, useState } from "react";

export interface UseArrowKeyNavOptions {
  selector?: string;
  cols?: number;
  /** Fired instead of clamping when ArrowLeft is pressed at the first item. */
  onBoundaryLeft?: () => void;
}

const TEXT_EDITABLE_INPUT_TYPES = new Set([
  "text",
  "number",
  "date",
  "email",
  "tel",
  "search",
  "password",
  "url",
]);

function isTextEditable(el: HTMLElement): boolean {
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type || "text";
    return TEXT_EDITABLE_INPUT_TYPES.has(type);
  }
  return false;
}

// Selection range isn't supported on every input type — Chromium returns
// null (not a throw) for type="number"/"date"/etc. rather than a real
// offset, so it must be checked explicitly: comparing null against a
// numeric target (0, or the value's length) is never true, which silently
// made caretAtEnd unreachable and stuck every such field's ArrowRight with
// no way out. Some other browsers throw instead for the same types, so
// that's still caught too. Either way, failing open (treating it as "at
// the boundary") means arrow-key navigation still works there instead of
// getting stuck with no way to tell the caret's real position.
function caretAtStart(el: HTMLElement): boolean {
  try {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    if (input.selectionStart === null || input.selectionEnd === null) return true;
    return input.selectionStart === 0 && input.selectionEnd === 0;
  } catch {
    return true;
  }
}

function caretAtEnd(el: HTMLElement): boolean {
  try {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    if (input.selectionStart === null || input.selectionEnd === null) return true;
    const length = input.value?.length ?? 0;
    return input.selectionStart === length && input.selectionEnd === length;
  } catch {
    return true;
  }
}

function isFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  return true;
}

// Walks from `fromIndex` in `step` increments (±1, or ±cols for a grid),
// skipping any disabled item along the way — e.g. the "State" picker here
// is disabled until a country's chosen, and landing focus on a disabled
// element is a silent no-op in every browser, which otherwise looks
// exactly like navigation being stuck. Returns -1 if nothing focusable is
// left in that direction.
function findNextFocusableIndex(items: HTMLElement[], fromIndex: number, step: number): number {
  let idx = fromIndex + step;
  while (idx >= 0 && idx < items.length) {
    if (isFocusable(items[idx])) return idx;
    idx += step;
  }
  return -1;
}

// Returns a *callback* ref, not a plain ref object — on purpose. Several
// callers (the Billing screen, ResourcePage, etc.) only render their
// `ref={...}` container on a later, conditional render (e.g. once a
// terminal's been picked), not on first mount. A plain useRef's effect only
// runs when its dependency array changes, which doesn't include "the DOM
// node the ref points to just appeared" — so the listener would silently
// never attach. A callback ref re-fires exactly when React attaches (or
// detaches) the node, so state — and therefore this effect — stays correct
// regardless of when the container actually shows up. React accepts a
// callback ref anywhere a ref object works, so callers need no changes.
export function useArrowKeyNav<T extends HTMLElement>({
  selector = "[data-navcard]",
  cols = 1,
  onBoundaryLeft,
}: UseArrowKeyNavOptions = {}) {
  const [container, setContainer] = useState<T | null>(null);
  const containerRef = useCallback((node: T | null) => {
    setContainer(node);
  }, []);

  useEffect(() => {
    if (!container) return;

    function getItems(): HTMLElement[] {
      return Array.from(container!.querySelectorAll<HTMLElement>(selector));
    }

    function handleKeyDown(event: KeyboardEvent) {
      const items = getItems();
      if (items.length === 0) return;

      const active = document.activeElement as HTMLElement | null;

      if (event.key === "Enter" || event.key === " ") {
        if (!active || !items.includes(active)) return;
        const isCheckbox = active.getAttribute("role") === "checkbox";
        // LABEL covers a styled upload tile wrapping a visually-hidden
        // <input type="file"> — a real file input can't be marked directly
        // since a hidden element is never focusable, so the label is the
        // focus target instead; native label semantics forward .click() to
        // the input it wraps, which is what actually opens the file picker.
        const isDivOrRow = ["DIV", "TR", "LABEL"].includes(active.tagName);
        if (event.key === "Enter" && (isCheckbox || isDivOrRow)) {
          event.preventDefault();
          active.click();
        } else if (event.key === " " && isDivOrRow) {
          event.preventDefault();
          active.click();
        }
        return;
      }

      const currentIndex = active ? items.indexOf(active) : -1;
      if (currentIndex === -1) return;

      // Base UI's Tabs (and other composite widgets sharing its roving-
      // tabindex logic) attach their own Left/Right handler directly on
      // the tab list — a closer ancestor than this container, so it runs
      // first on every bubbled keydown. Racing it by also moving focus
      // here produces exactly the double-move it looks like: Base UI
      // switches tabs internally, then this handler immediately overrides
      // that with its own (now-stale) idea of what should come next.
      // Deferring here, the same way text fields defer to native caret
      // movement, leaves Left/Right entirely to the tablist while focus
      // sits on one of its tabs.
      if (active!.getAttribute("role") === "tab") return;

      const textEditable = isTextEditable(active!);

      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && textEditable) {
        return;
      }
      if (event.key === "ArrowLeft" && textEditable && !caretAtStart(active!)) return;
      if (event.key === "ArrowRight" && textEditable && !caretAtEnd(active!)) return;

      let nextIndex: number;
      switch (event.key) {
        case "ArrowDown":
          nextIndex = findNextFocusableIndex(items, currentIndex, cols);
          if (nextIndex === -1) return;
          break;
        case "ArrowUp":
          nextIndex = findNextFocusableIndex(items, currentIndex, -cols);
          if (nextIndex === -1) return;
          break;
        case "ArrowRight":
          nextIndex = findNextFocusableIndex(items, currentIndex, 1);
          if (nextIndex === -1) return;
          break;
        case "ArrowLeft":
          nextIndex = findNextFocusableIndex(items, currentIndex, -1);
          if (nextIndex === -1) {
            if (onBoundaryLeft) {
              event.preventDefault();
              onBoundaryLeft();
            }
            return;
          }
          break;
        default:
          return;
      }

      event.preventDefault();
      items[nextIndex]?.focus();
    }

    // A tracked item can be unmounted while it holds focus — e.g. a
    // DataTable row disappearing when a debounced search re-renders the
    // list. Browsers move focus to <body> with no relatedTarget when that
    // happens (vs. a real relatedTarget for any focus change we caused
    // ourselves), which otherwise strands keyboard nav with no recovery.
    function handleFocusOut(event: FocusEvent) {
      if (event.relatedTarget !== null) return;
      const target = event.target as HTMLElement | null;
      if (!target || !container!.contains(target)) return;
      requestAnimationFrame(() => {
        if (document.activeElement !== document.body) return;
        const items = getItems();
        const fallback = items.find(isFocusable);
        fallback?.focus();
      });
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const activeEl = document.activeElement;
      if (
        activeEl !== null &&
        activeEl !== document.body &&
        activeEl !== document.documentElement
      ) {
        return;
      }
      const items = getItems();
      const fallback = items.find(isFocusable);
      if (!fallback) return;
      event.preventDefault();
      fallback.focus();
    }

    container.addEventListener("keydown", handleKeyDown);
    container.addEventListener("focusout", handleFocusOut);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      container.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [container, selector, cols, onBoundaryLeft]);

  return containerRef;
}
