import { renderLabelHtml, renderReceiptHtml } from "./browser";
import type { HardwareBridge, PrintPayload } from "./types";

// Deliberately typed here rather than imported from @capacitor/core — the web
// app must not depend on a package that only the Android shell installs.
interface CapacitorPrintPlugin {
  print(options: { html: string }): Promise<void>;
}

declare global {
  interface Window {
    Capacitor?: {
      Plugins?: { Hardware?: CapacitorPrintPlugin };
    };
  }
}

// Android's WebView has no window.print(), and window.open() is handed to the
// system browser — so the browser fallback can't print inside the app at all.
// Everything is flattened to HTML here and handed to the native plugin, which
// runs it through Android's own print pipeline.
function toHtml(payload: PrintPayload): string {
  if (payload.kind === "html") return payload.html;
  if (payload.kind === "receipt") return renderReceiptHtml(payload);
  return renderLabelHtml(payload);
}

export function getCapacitorPrintBridge(): HardwareBridge | null {
  if (typeof window === "undefined") return null;
  const plugin = window.Capacitor?.Plugins?.Hardware;
  if (!plugin) return null;

  return {
    async print(payload: PrintPayload): Promise<void> {
      await plugin.print({ html: toHtml(payload) });
    },
  };
}
