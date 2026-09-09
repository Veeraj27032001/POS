# POS desktop shell (Electron)

A thin Electron wrapper that loads the hosted POS app (same Next.js app as the rest of this repo — this doesn't change how it's deployed) in a `BrowserWindow` with no menu bar, and bridges receipt printer, cash drawer, and card-terminal hardware into it via a `contextBridge` preload script (`window.hardware`). Barcode scanners need no special handling — they emulate a keyboard.

This is a separate package (its own `package.json`, `node_modules`, `tsconfig.json`) — not a pnpm workspace member of the root app, since the two share almost no runtime dependencies. Install and run everything below from inside `electron/`.

## Setup

```bash
pnpm install
cp .env.example .env
```

`.env` is git-ignored — it's for local development only. Leave `SERVER_URL` commented out to point at `pnpm dev` on `http://localhost:3000`; a packaged installer ships with no `.env` at all and falls back to the real production URL (`config.ts`'s Zod schema default). A specific till can be repointed after install via `%APPDATA%/pos-electron/config.json`, with no rebuild needed.

## Day to day

```bash
pnpm run dev      # esbuild watch — rebuilds dist/main/ on save
pnpm run start    # launch the app (a separate step — Electron's main
                   # process doesn't hot-reload; re-run this after a
                   # rebuild to see main-process changes)
pnpm run typecheck
```

Run `pnpm run dev` in one terminal and `pnpm run start` in another. With `SERVER_URL` pointed at `http://localhost:3000`, also run `pnpm dev` at the repo root so there's a page to load.

In an unpackaged run (`!app.isPackaged`), DevTools opens automatically and a Chrome DevTools Protocol port is exposed on `9223` for external inspection (e.g. Playwright's `chromium.connectOverCDP("http://localhost:9223")`) — both are compiled out of a packaged build.

## Hardware config

Set in `.env` for dev, or `%APPDATA%/pos-electron/config.json` (JSON, same field names) per-till after install:

- `PRINTER_TRANSPORT` — `none` (default; builds the print job and logs a preview to the console instead of sending it), `network` (`PRINTER_HOST`/`PRINTER_PORT`, ESC/POS over TCP — the cash drawer, if wired to the printer's kick-out port, opens through this same connection), `windows` (`PRINTER_WINDOWS_NAME`, a shared/named Windows printer queue), or `serial` (`PRINTER_SERIAL_PATH`).
- `DOCUMENT_PRINTER_NAME` — the OS printer used for full HTML documents (bill/credit-note/refund formats), separate from the thermal receipt printer above since a store may print those to a different printer. Leave unset to use the OS default.
- `KIOSK_MODE` — `true` locks the window into OS-level kiosk mode. Defaults to `false` (maximized, no menu bar, but not locked down).

`chargeCard` (card-machine payments) is an honest stub — it always resolves `{status: "unavailable"}`; the cashier confirms the payment manually once the physical terminal approves. There's no real Razorpay POS device SDK integration in this build.

## Packaging

```bash
pnpm run dist
```

Regenerates `build/icon.ico` from `../app/icon.png`, builds the bundle, then runs `electron-builder` (config in `electron-builder.yml`) to produce a Windows NSIS installer under `release/`. Uninstalling removes the Add/Remove Programs entry, Start Menu shortcut, and desktop shortcut, but leaves `%APPDATA%/pos-electron` (local config/session data) behind, same as most installers — delete it manually for a fully clean slate.

## Structure

```
src/main/
  index.ts              app lifecycle, BrowserWindow, menu, navigation policy
  config.ts              Zod-validated config (own schema — not the Next.js app's lib/config/env.ts)
  preload.ts              contextBridge.exposeInMainWorld("hardware", ...)
  ipc/hardware.ts         ipcMain handlers, dispatches by print-payload kind
  hardware/
    printerConnection.ts  transport factory: network | windows | serial | none
    receiptPrinter.ts      ESC/POS receipt printing
    labelPrinter.ts        ESC/POS label + barcode printing
    htmlPrinter.ts          full HTML documents via a hidden BrowserWindow + webContents.print()
```
