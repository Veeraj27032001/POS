import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const watch = process.argv.includes("--watch");

const entryPoints = [join(root, "src/main/index.ts")];
const preloadEntry = join(root, "src/main/preload.ts");
if (existsSync(preloadEntry)) entryPoints.push(preloadEntry);

const options = {
  entryPoints,
  outdir: join(root, "dist/main"),
  bundle: true,
  platform: "node",
  target: "node24", // matches the Node version Electron 44 bundles in its main process
  format: "cjs",
  sourcemap: true,
  // electron itself, and any native module resolved at runtime via
  // require(), must stay external — bundling them breaks native bindings.
  external: ["electron", "node-thermal-printer"],
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(options);
}
