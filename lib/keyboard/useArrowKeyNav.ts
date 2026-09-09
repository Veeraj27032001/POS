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
// null (not a throw; confirmed directly, not assumed) for
// type="number"/"date" rather than a real offset. For those two, failing
// open (treating it as "at the boundary") is actually correct: each owns
// Left/Right internally for its own spinner/segment behavior, so there's
// no real caret position to preserve and handing the keystroke onward is
// the right call. type="email" returns null too, but has no such native
// owner — it's a plain text field like any other, so failing open there
// instead made every Left/Right on it act as if the caret were always at
// both ends simultaneously, ejecting focus on the very first keystroke
// regardless of where the caret actually was. Anything else that reports
// null (a future input type, or a browser that returns null somewhere
// Chromium doesn't) fails closed instead — Left/Right simply won't be a
// way to leave that field, same as a plain page with no custom nav at
// all; Tab still works. Some browsers throw instead of returning null for
// the same types, so that's caught too, with the same type-based split.
const BOUNDARY_FAILS_OPEN_TYPES = new Set(["number", "date"]);

function failsOpen(el: HTMLElement): boolean {
  return el.tagName === "INPUT" && BOUNDARY_FAILS_OPEN_TYPES.has((el as HTMLInputElement).type);
}

function caretAtStart(el: HTMLElement): boolean {
  try {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    if (input.selectionStart === null || input.selectionEnd === null) return failsOpen(el);
    return input.selectionStart === 0 && input.selectionEnd === 0;
  } catch {
    return failsOpen(el);
  }
}

function caretAtEnd(el: HTMLElement): boolean {
  try {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    if (input.selectionStart === null || input.selectionEnd === null) return failsOpen(el);
    const length = input.value?.length ?? 0;
    return input.selectionStart === length && input.selectionEnd === length;
  } catch {
    return failsOpen(el);
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

      // Base UI's (horizontal) Tabs attaches its own Left/Right handler
      // directly on the tab list — a closer ancestor than this container,
      // so it runs first on every bubbled keydown. Racing it by also
      // moving focus here produces exactly the double-move it looks like:
      // Base UI switches tabs internally, then this handler immediately
      // overrides that with its own (now-stale) idea of what should come
      // next. Deferring here, the same way text fields defer to native
      // caret movement, leaves Left/Right entirely to the tablist while
      // focus sits on one of its tabs. Up/Down are NOT handled by a
      // horizontal tablist at all, so they must keep falling through to
      // this hook's own logic below — otherwise a tab is a dead end with
      // no way to reach whatever's tracked below the tab list.
      const isHorizontalTab =
        active!.getAttribute("role") === "tab" &&
        active!.closest('[role="tablist"]')?.getAttribute("aria-orientation") !== "vertical";
      if (isHorizontalTab && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return;

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

    // Nearest enclosing dialog/popover, or null for the plain page — used
    // to tell whether an untracked focused element actually belongs to
    // *this* instance's scope (e.g. a dialog's own Close button, focused
    // by the dialog library itself before any tracked item exists) versus
    // some other, unrelated instance's scope (e.g. the page underneath an
    // open dialog).
    function scopeRootOf(el: Element | null): Element | null {
      return el?.closest('[data-slot="dialog-content"], [data-slot="popover-content"]') ?? null;
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const activeEl = document.activeElement as HTMLElement | null;
      const items = getItems();
      if (items.length === 0) return;
      // Already on one of this instance's own items — the container
      // listener above owns this keystroke, nothing to rescue.
      if (activeEl && items.includes(activeEl)) return;
      // Focus is real (not body/html) and sitting in some other scope
      // (e.g. the page behind an open dialog, or a different dialog) —
      // leave it alone; that scope's own instance is responsible.
      if (scopeRootOf(activeEl) !== scopeRootOf(container)) return;
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
