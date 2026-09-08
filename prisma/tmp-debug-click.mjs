import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}`));

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

  await page.goto(`${BASE}/products`);
  await page.waitForLoadState("networkidle");

  console.log("--- Test 1: element.click() via page.evaluate ---");
  await page.evaluate(() => {
    const a = document.querySelector('nav[aria-label="Main navigation"] a[href="/bills"]');
    a?.click();
  });
  await page.waitForTimeout(1500);
  console.log("URL after evaluate-click:", page.url());

  await page.goto(`${BASE}/products`);
  await page.waitForLoadState("networkidle");

  console.log("--- Test 2: Playwright locator.click() (real synthetic mouse event) ---");
  await page.locator('nav[aria-label="Main navigation"] a[href="/bills"]').click();
  await page.waitForTimeout(1500);
  console.log("URL after locator-click:", page.url());

  await browser.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
