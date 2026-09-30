import { chromium } from "playwright";

const pdf = process.argv[2];
const outPrefix = process.argv[3];
const pages = Number(process.argv[4] ?? 3);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1300 } });
await page.goto(`file:///${pdf.replace(/\\/g, "/")}`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(9000);

for (let i = 0; i < pages; i++) {
  await page.screenshot({ path: `${outPrefix}-${String(i + 1).padStart(2, "0")}.png` });
  await page.keyboard.press("PageDown");
  await page.waitForTimeout(1600);
}
await browser.close();
console.log("done");
