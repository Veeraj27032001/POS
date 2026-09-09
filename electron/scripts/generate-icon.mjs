import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pngToIco from "png-to-ico";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePng = join(__dirname, "..", "..", "app", "icon.png");
const buildDir = join(__dirname, "..", "build");
const outIco = join(buildDir, "icon.ico");

const SIZES = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });

  const frames = await Promise.all(
    SIZES.map((size) => sharp(sourcePng).resize(size, size).png().toBuffer()),
  );
  const icoBuffer = await pngToIco(frames);
  writeFileSync(outIco, icoBuffer);

  console.log(`Wrote ${outIco} (${SIZES.join(", ")} px frames)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
