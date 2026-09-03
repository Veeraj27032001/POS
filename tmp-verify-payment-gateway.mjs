import { chromium } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: "c:/projects/POS/.env.local" });

const BASE = "http://localhost:3100";
const EMAIL = process.env.SEED_ADMIN2_EMAIL;
const PASSWORD = process.env.SEED_ADMIN2_PASSWORD;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(60000);
page.setDefaultNavigationTimeout(60000);
const errors = [];
page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password").fill(PASSWORD);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((url) => url.pathname === "/select-financial-year" || url.pathname === "/", {
  timeout: 60000,
});
if (page.url().includes("select-financial-year")) {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 60000 });
}

await page.goto(`${BASE}/billing`);
await page.waitForSelector("text=New Bill", { timeout: 30000 });
await page.waitForTimeout(1500);

// Handle the terminal-select start screen if it appears.
const continueBtn = page.getByRole("button", { name: /^Continue$/ });
if ((await continueBtn.count()) > 0) {
  const terminalSelect = page.getByText(/Select terminal/i).first();
  await terminalSelect.click();
  await page.waitForTimeout(600);
  const firstOption = page.locator('[role="option"], [data-slot="command-item"], [cmdk-item]').first();
  await firstOption.waitFor({ timeout: 10000 });
  await firstOption.click();
  await page.waitForTimeout(300);
  await continueBtn.click();
  await page.waitForTimeout(1500);
}

// Find a real product name via the API (reusing the authenticated session)
// rather than guessing one that might not exist in this store's catalog.
const productsRes = await page.request.get(`${BASE}/api/products?pageSize=5`);
const productsBody = await productsRes.json();
const productName = productsBody.data?.[0]?.name;
console.log("using product for search:", productName);

// Add a product to the cart via search.
const scanInput = page.getByPlaceholder(/Scan or search/i);
await scanInput.click();
await scanInput.fill(productName ?? "Maggie");
await page.waitForTimeout(3000);
await page.screenshot({ path: "c:/projects/POS/tmp-billing-search-results.png" });
const firstResult = page
  .locator('[role="option"], li, [data-slot="command-item"], tr, button')
  .filter({ hasText: productName ?? "Maggie" })
  .first();
if ((await firstResult.count()) > 0) {
  await firstResult.click();
} else {
  console.log("No product match UI found — trying Enter key");
  await scanInput.press("Enter");
}
await page.waitForTimeout(1500);

const bodyText = await page.textContent("body");
console.log("has 'Collect via QR / Link / Card' button:", bodyText.includes("Collect via QR"));

await page.screenshot({ path: "c:/projects/POS/tmp-billing-with-gateway-btn.png" });

console.log("\nerrors:", errors.length ? errors.join("\n") : "(none)");
await browser.close();
