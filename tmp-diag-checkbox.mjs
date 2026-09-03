import { chromium } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: "c:/projects/POS/.env.local" });

const BASE = "http://localhost:3100";
const EMAIL = process.env.SEED_ADMIN2_EMAIL;
const PASSWORD = process.env.SEED_ADMIN2_PASSWORD;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(30000);
const errors = [];
page.on("console", (msg) => errors.push(`[console:${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => errors.push(`[pageerror] ${err}`));

await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password").fill(PASSWORD);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((url) => url.pathname === "/select-financial-year" || url.pathname === "/", {
  timeout: 30000,
});
if (page.url().includes("select-financial-year")) {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 30000 });
}

await page.goto(`${BASE}/billing`);
await page.waitForSelector("text=New Bill", { timeout: 20000 });
await page.waitForTimeout(1500);
const continueBtn = page.getByRole("button", { name: /^Continue$/ });
if ((await continueBtn.count()) > 0) {
  await page.getByText(/Select terminal/i).first().click();
  await page.waitForTimeout(600);
  await page.locator('[role="option"], [data-slot="command-item"], [cmdk-item]').first().click();
  await page.waitForTimeout(300);
  await continueBtn.click();
  await page.waitForTimeout(1500);
}

const productsRes = await page.request.get(`${BASE}/api/products?pageSize=5`);
const productName = (await productsRes.json()).data?.[0]?.name;
const scanInput = page.getByPlaceholder(/Scan or search/i);
await scanInput.click();
await scanInput.fill(productName);
await page.waitForTimeout(2500);
const firstResult = page
  .locator('[role="option"], li, [data-slot="command-item"], tr, button')
  .filter({ hasText: productName })
  .first();
if ((await firstResult.count()) > 0) await firstResult.click();
await page.waitForTimeout(3000);

console.log("--- looking for checkbox ---");
const checkboxes = await page.getByRole("checkbox").all();
for (const cb of checkboxes) {
  const label = await cb.getAttribute("aria-label").catch(() => null);
  console.log("checkbox found, aria-label:", label);
}

await page.screenshot({ path: "c:/projects/POS/tmp-diag-before-check.png", fullPage: false });

const gatewayCheckbox = page.getByRole("checkbox", { name: /Collect via QR/i });
const count = await gatewayCheckbox.count();
console.log("gateway checkbox locator count:", count);
if (count > 0) {
  await gatewayCheckbox.click();
  await page.waitForTimeout(500);
}

await page.screenshot({ path: "c:/projects/POS/tmp-diag-after-check.png", fullPage: false });

const buttons = await page.getByRole("button").allTextContents();
console.log("all button texts on page:", JSON.stringify(buttons));

console.log("\nerrors/console:", errors.length ? errors.join("\n") : "(none)");
await browser.close();
