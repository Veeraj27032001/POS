import { chromium } from "playwright";

const EMAIL = "tmp-nav-test@example.com";
const PASSWORD = "TmpNavTest123!";
const PRODUCT_ID = "49313860-3049-46b0-abef-f1a8302ff106";
const TERMINAL_ID = "4466b16d-1a61-4b31-bf01-c37da89b2c2d";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto("http://localhost:3000/login");
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45000 }).catch(() => {});
  if (page.url().includes("/select-financial-year")) {
    const continueBtn = page.locator('button:has-text("Continue")').first();
    await continueBtn.waitFor({ state: "visible", timeout: 15000 });
    for (let i = 0; i < 15; i++) {
      if (!(await continueBtn.isDisabled())) break;
      await page.waitForTimeout(1000);
    }
    await continueBtn.click();
    await page.waitForURL((url) => !url.pathname.includes("/select-financial-year"), { timeout: 15000 }).catch(() => {});
  }
  await page.waitForTimeout(1000);

  async function api(method, url, body) {
    return page.evaluate(
      async ({ method, url, body }) => {
        const res = await fetch(url, {
          method,
          headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        return { status: res.status, json: await res.json().catch(() => null) };
      },
      { method, url, body },
    );
  }

  console.log("=== TEST: Save Draft redirects to /billing/drafts ===");
  await page.goto("http://localhost:3000/billing", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  // If a terminal picker shows, pick the first one.
  let bodyText = await page.locator("body").innerText();
  if (bodyText.includes("Select a terminal")) {
    const trigger = page.locator('button, [role="combobox"]').filter({ hasText: /Select terminal|Select…/ }).first();
    await trigger.click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('[cmdk-item]').first().click().catch(() => {});
    await page.waitForTimeout(300);
    const startBtn = page.locator('button:has-text("Start Billing"), button:has-text("Start")').first();
    if ((await startBtn.count()) > 0) await startBtn.click();
    await page.waitForTimeout(1000);
  }

  const scanInput = page.locator('input[placeholder*="Scan or search"]').first();
  await scanInput.fill("Maggie 20rs");
  await page.waitForTimeout(1500);
  const firstMatch = page.locator('button:has-text("Maggie 20rs")').first();
  if ((await firstMatch.count()) > 0) {
    await firstMatch.click();
    await page.waitForTimeout(500);
  } else {
    console.log("No product match found via search, aborting this test path.");
  }

  const saveDraftBtn = page.locator('button:has-text("Save draft")').first();
  console.log("Save draft button found:", await saveDraftBtn.count());
  if ((await saveDraftBtn.count()) > 0) {
    await saveDraftBtn.click();
    await page.waitForTimeout(2000);
    console.log("URL after Save draft (expect /billing/drafts):", page.url());
  }

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
