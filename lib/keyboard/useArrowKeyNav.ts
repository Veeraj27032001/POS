"use client";

import { useEffect, useRef } from "react";

export interface UseArrowKeyNavOptions {
  selector?: string;
  cols?: number;
}

export function useArrowKeyNav<T extends HTMLElement>({
  selector = "[data-navcard]",
  cols = 1,
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
      const currentIndex = active ? items.indexOf(active) : -1;

      if (event.key === "Enter" || event.key === " ") {
        if (active && active.tagName === "DIV" && items.includes(active)) {
          event.preventDefault();
          active.click();
        }
        return;
      }

      if (
        currentIndex === -1 &&
        !["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)
      ) {
        return;
      }

      let nextIndex = currentIndex;
      switch (event.key) {
        case "ArrowDown":
          nextIndex = currentIndex === -1 ? 0 : Math.min(items.length - 1, currentIndex + cols);
          break;
        case "ArrowUp":
          nextIndex = currentIndex === -1 ? 0 : Math.max(0, currentIndex - cols);
          break;
        case "ArrowRight":
          nextIndex = currentIndex === -1 ? 0 : Math.min(items.length - 1, currentIndex + 1);
          break;
        case "ArrowLeft":
          nextIndex = currentIndex === -1 ? 0 : Math.max(0, currentIndex - 1);
          break;
        default:
          return;
      }

      event.preventDefault();
      items[nextIndex]?.focus();
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [selector, cols]);

  return containerRef;
}
