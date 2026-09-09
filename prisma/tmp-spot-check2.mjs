import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
const BILL_FORMAT_ID = process.argv[4];

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });
  await page.waitForLoadState("networkidle");
  if (page.url().includes("select-financial-year")) {
    await page.getByRole("combobox").first().click();
    await page.waitForTimeout(500);
    await page.getByRole("option", { name: /2026-27/ }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL((u) => !u.pathname.includes("select-financial-year"), { timeout: 30000 });
    await page.waitForLoadState("networkidle");
  }
}

async function dumpAndWalk(page, label, steps = 6) {
  await page.waitForTimeout(1500);
  const count = await page.evaluate(() => document.querySelectorAll("[data-kbd-item]").length);
  console.log(`[${label}] tracked items: ${count}`);
  if (count === 0) return;
  await page.evaluate(() => document.querySelectorAll("[data-kbd-item]")[0].focus());
  await page.waitForTimeout(200);
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    const state = await page.evaluate(() => {
      const a = document.activeElement;
      const all = Array.from(document.querySelectorAll("[data-kbd-item]"));
      return { tag: a?.tagName, index: all.indexOf(a) };
    });
    console.log(`  [${label}] step ${i}: index=${state.index} ${state.tag}`);
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  await login(page);

  // Bill Format Design page, direct navigation.
  await page.goto(`${BASE}/bill-formats/${BILL_FORMAT_ID}/design`);
  await page.waitForLoadState("networkidle");
  await dumpAndWalk(page, "bill-format-design", 6);

  const startBtn = page.locator('button:has-text("Start visual design")');
  if ((await startBtn.count()) > 0) {
    console.log("Clicking Start visual design...");
    await startBtn.click();
    await page.waitForTimeout(800);
    const chips = await page.evaluate(() => document.querySelectorAll("[data-kbd-item]").length);
    console.log("[bill-format-design] items after Start visual design:", chips);

    // Add a block via the palette (keyboard-equivalent path: click == Enter on a focused button).
    const paletteBtn = page.locator('button:has-text("Header")').first();
    if ((await paletteBtn.count()) > 0) {
      await paletteBtn.click();
      await page.waitForTimeout(500);
      const afterAdd = await page.evaluate(() => document.querySelectorAll("[data-kbd-item]").length);
      console.log("[bill-format-design] items after adding Header block:", afterAdd);

      // Test the move-up/move-down buttons exist and are clickable.
      const moveDownBtn = page.locator('button[aria-label="Move down"]').first();
      console.log("Move down button exists:", (await moveDownBtn.count()) > 0);
    }
  }

  await browser.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
