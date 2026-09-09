// A plain `electron .` inherits whatever's in the parent shell's
// environment — and some terminal/tooling setups (this one included, at
// least in dev) leak ELECTRON_RUN_AS_NODE=1 into every child process,
// which makes Electron boot as a bare Node runtime instead of initializing
// itself: require("electron") then returns the path to the binary instead
// of the {app, BrowserWindow, ...} API, and every main-process call blows
// up. cross-env can only set env vars, not remove one — so this deletes it
// outright before spawning the real binary, which is the only thing that
// actually works.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// The .bin/electron(.cmd) shim is a batch script on Windows, which
// child_process.spawn can't execute directly without shell:true — go
// straight at the real binary electron/index.js itself resolves to.
const electronBin = process.platform === "win32"
  ? join(__dirname, "..", "node_modules", "electron", "dist", "electron.exe")
  : join(__dirname, "..", "node_modules", "electron", "dist", "electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBin, ["."], {
  cwd: join(__dirname, ".."),
  env,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => process.exit(code ?? 0));
