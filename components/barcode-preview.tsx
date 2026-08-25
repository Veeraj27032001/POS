"use client";

import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";

export function BarcodePreview({ value, height = 40 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, { height, fontSize: 12, margin: 0, displayValue: false });
    } catch {
      ref.current.innerHTML = "";
    }
  }, [value, height]);

  return <svg ref={ref} className="max-w-full" />;
}
