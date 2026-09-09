import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];

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
  await login(page);

  // 1. Bill Formats Design page
  await page.goto(`${BASE}/bill-formats`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  const designLink = page.locator('a:has-text("Design")').first();
  const hasDesign = await designLink.count();
  console.log("Design link found:", hasDesign);
  if (hasDesign > 0) {
    await designLink.click();
    await page.waitForURL(/\/design$/, { timeout: 15000 });
    await dumpAndWalk(page, "bill-format-design", 8);

    // If in HTML-only mode, click "Start visual design" to test the block canvas.
    const startBtn = page.locator('button:has-text("Start visual design")');
    if ((await startBtn.count()) > 0) {
      await startBtn.click();
      await page.waitForTimeout(500);
      const chips = await page.evaluate(() => document.querySelectorAll("[data-kbd-item]").length);
      console.log("[bill-format-design] items after Start visual design:", chips);
    }
  }

  // 2. Products view page
  await page.goto(`${BASE}/products`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  const firstProductLink = page.locator('a[href^="/products/"]').first();
  if ((await firstProductLink.count()) > 0) {
    await firstProductLink.click();
    await page.waitForURL(/\/products\/[^/]+$/, { timeout: 15000 });
    await dumpAndWalk(page, "product-detail", 6);
  }

  // 3. Stock Damage edit page spot check
  await page.goto(`${BASE}/stock-damages`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  const firstDamageRow = page.locator("tbody tr").first();
  if ((await firstDamageRow.count()) > 0) {
    await firstDamageRow.click();
    await page.waitForURL(/\/stock-damages\/[^/]+$/, { timeout: 15000 });
    await page.waitForTimeout(1000);
    const editLink = page.locator('a:has-text("Edit")');
    if ((await editLink.count()) > 0) {
      await editLink.click();
      await page.waitForURL(/\/edit$/, { timeout: 15000 });
      await dumpAndWalk(page, "stock-damage-edit", 6);
    }
  }

  await browser.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
