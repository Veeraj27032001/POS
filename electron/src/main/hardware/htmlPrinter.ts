import { BrowserWindow } from "electron";

import type { loadConfig } from "../config";

type ElectronConfig = ReturnType<typeof loadConfig>;

// Store-authored Bill Format HTML (arbitrary layout/CSS, no paper-size
// field on the model) can't be reinterpreted as ESC/POS text the way a
// structured receipt/label payload can — this goes through Chromium's own
// print pipeline instead: a hidden window loads the HTML, then
// webContents.print() sends it straight to a system printer, silently (no
// print dialog, matching what window.print() would otherwise show one
// for). That target can be the same physical thermal printer if it's also
// installed as a plain Windows printer queue, or a separate one entirely
// (e.g. an A4 printer for full GST invoices vs. a narrow thermal printer
// for receipts) — hence DOCUMENT_PRINTER_NAME being a separate config knob
// from PRINTER_*.
export function printHtml(html: string, config: ElectronConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });

    win.webContents.once("did-finish-load", () => {
      win.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: config.DOCUMENT_PRINTER_NAME || undefined,
        },
        (success, failureReason) => {
          win.destroy();
          if (success) resolve();
          else reject(new Error(`Print failed: ${failureReason}`));
        },
      );
    });

    win.webContents.once("did-fail-load", (_event, _code, description) => {
      win.destroy();
      reject(new Error(`Failed to load print content: ${description}`));
    });

    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}
