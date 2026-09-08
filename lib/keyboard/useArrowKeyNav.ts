"use client";

import { useEffect, useRef } from "react";

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

// Selection range isn't supported on every input type (e.g. some browsers
// throw or return null for type="date"/"email") — failing open (treating it
// as "at the boundary") means arrow-key navigation still works there instead
// of getting stuck with no way to tell the caret's real position.
function caretAtStart(el: HTMLElement): boolean {
  try {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    return (input.selectionStart ?? 0) === 0 && (input.selectionEnd ?? 0) === 0;
  } catch {
    return true;
  }
}

function caretAtEnd(el: HTMLElement): boolean {
  try {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    const length = input.value?.length ?? 0;
    return input.selectionStart === length && input.selectionEnd === length;
  } catch {
    return true;
  }
}

export function useArrowKeyNav<T extends HTMLElement>({
  selector = "[data-navcard]",
  cols = 1,
  onBoundaryLeft,
}: UseArrowKeyNavOptions = {}) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
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
        const isDivOrRow = active.tagName === "DIV" || active.tagName === "TR";
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

      const textEditable = isTextEditable(active!);

      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && textEditable) {
        return;
      }
      if (event.key === "ArrowLeft" && textEditable && !caretAtStart(active!)) return;
      if (event.key === "ArrowRight" && textEditable && !caretAtEnd(active!)) return;

      let nextIndex = currentIndex;
      switch (event.key) {
        case "ArrowDown":
          nextIndex = Math.min(items.length - 1, currentIndex + cols);
          break;
        case "ArrowUp":
          nextIndex = Math.max(0, currentIndex - cols);
          break;
        case "ArrowRight":
          nextIndex = Math.min(items.length - 1, currentIndex + 1);
          break;
        case "ArrowLeft":
          if (currentIndex === 0) {
            if (onBoundaryLeft) {
              event.preventDefault();
              onBoundaryLeft();
            }
            return;
          }
          nextIndex = currentIndex - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      items[nextIndex]?.focus();
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [selector, cols, onBoundaryLeft]);

  return containerRef;
}
