import { join } from "node:path";

import { app, BrowserWindow, Menu, shell } from "electron";

import { loadConfig } from "./config";
import { registerHardwareIpc } from "./ipc/hardware";

// A cashier double-clicking the desktop icon twice shouldn't end up with two
// windows independently opening their own printer connections and
// interleaving ESC/POS jobs on a shared serial/USB transport.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Dev-only CDP access for external inspection/automation (e.g. Playwright's
// chromium.connectOverCDP), never enabled in a packaged build.
if (!app.isPackaged) {
  app.commandLine.appendSwitch("remote-debugging-port", "9223");
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const config = loadConfig();

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    kiosk: config.KIOSK_MODE,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, "preload.js"),
    },
  });

  // A File/Edit/Window menu bar is meaningless on a till and is an easy way
  // to accidentally navigate somewhere odd.
  Menu.setApplicationMenu(null);
  mainWindow.setAutoHideMenuBar(true);

  mainWindow.once("ready-to-show", () => {
    if (!config.KIOSK_MODE) mainWindow?.maximize();
    mainWindow?.show();
  });

  const serverOrigin = new URL(config.SERVER_URL).origin;

  // components/billing/send-link-panel.tsx opens mailto:/WhatsApp links via
  // window.open() — those need to hand off to the OS, not open a second
  // in-app window on a kiosk device.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // Cheap insurance against the kiosk window ever navigating off the POS app.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== serverOrigin) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  void mainWindow.loadURL(config.SERVER_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  registerHardwareIpc(loadConfig());
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
