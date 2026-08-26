"use client";

import { useEffect, useRef, useState } from "react";

// Real upload progress arrives in uneven jumps — a handful of large chunks,
// or a fast connection finishing near-instantly — which reads as the
// number sitting still and then jumping (10% ... 20%) rather than counting
// up. Animate the displayed value toward the real target at a steady rate
// instead, so it always looks like continuous progress (10, 11, 12, 13…),
// regardless of how choppy the real underlying updates are.
const RATE_PER_SECOND = 1; // 0 -> 1 (100%) in ~1s if the target is already there

export function useSmoothedProgress(target: number): number {
  const [displayed, setDisplayed] = useState(target);
  const displayedRef = useRef(target);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    let frameId: number;
    let lastTime = performance.now();

    function tick(now: number) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const diff = targetRef.current - displayedRef.current;
      if (Math.abs(diff) > 0.001) {
        const step = Math.sign(diff) * Math.min(Math.abs(diff), RATE_PER_SECOND * dt);
        displayedRef.current += step;
        setDisplayed(displayedRef.current);
      }
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return displayed;
}
