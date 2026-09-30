import { mkdirSync } from "fs";
import sharp from "sharp";

const SRC = "C:/Users/veeraj/Downloads/LOGO_.png";
const ROOT = "C:/projects/POS";

const meta = await sharp(SRC).metadata();
console.log(`source: ${meta.width}x${meta.height}, alpha=${meta.hasAlpha}`);

// The artwork is navy line-art on a solid white field with no alpha channel.
// Drop the white out to transparency, ramping alpha across the near-white
// range so anti-aliased edges stay smooth instead of going jagged.
const FULLY_TRANSPARENT_AT = 250; // >= this on every channel -> invisible
const FULLY_OPAQUE_AT = 200; // <= this on any channel -> untouched

async function transparentLogo() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += info.channels) {
    const whiteness = Math.min(data[i], data[i + 1], data[i + 2]);
    if (whiteness >= FULLY_TRANSPARENT_AT) {
      data[i + 3] = 0;
    } else if (whiteness > FULLY_OPAQUE_AT) {
      const ramp = (whiteness - FULLY_OPAQUE_AT) / (FULLY_TRANSPARENT_AT - FULLY_OPAQUE_AT);
      data[i + 3] = Math.round(255 * (1 - ramp));
    }
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer();
}

const cutout = await transparentLogo();

// Pads to a square so the wide logo is never cropped by square/round slots.
async function square(size, out, { marginRatio = 0.08, background } = {}) {
  const inner = Math.round(size * (1 - marginRatio * 2));
  const logo = await sharp(cutout)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);
  console.log(`wrote ${out} (${size}x${size})${background ? " on white" : " transparent"}`);
}

mkdirSync(`${ROOT}/public/icons`, { recursive: true });

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// Sidebar / auth pages / favicon — transparent, so they sit on any theme.
await square(512, `${ROOT}/public/logo.png`);
await square(512, `${ROOT}/app/icon.png`);

// iOS composites apple-touch icons onto black, so this one keeps a white field.
await square(180, `${ROOT}/app/apple-icon.png`, { marginRatio: 0.06, background: WHITE });

// Manifest icons: "any" may be transparent, "maskable" must be opaque because
// Android crops it to a circle and fills the remainder.
await square(192, `${ROOT}/public/icons/icon-192.png`);
await square(512, `${ROOT}/public/icons/icon-512.png`);
await square(512, `${ROOT}/public/icons/icon-maskable-512.png`, {
  marginRatio: 0.18,
  background: WHITE,
});

// Full-width original with the white dropped out, for letterheads and prints.
await sharp(cutout).png().toFile(`${ROOT}/public/logo-full.png`);
console.log("wrote public/logo-full.png (original proportions, transparent)");
