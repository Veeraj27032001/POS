import { useRef } from "react";

export function useSubmitGuard<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<void>,
): (...args: TArgs) => Promise<void> {
  const submittingRef = useRef(false);

  return async (...args: TArgs) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await fn(...args);
    } finally {
      submittingRef.current = false;
    }
  };
}
