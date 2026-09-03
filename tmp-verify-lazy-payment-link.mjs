import { chromium } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: "c:/projects/POS/.env.local" });

const BASE = "http://localhost:3100";
const EMAIL = process.env.SEED_ADMIN2_EMAIL;
const PASSWORD = process.env.SEED_ADMIN2_PASSWORD;

const browser = await chromium.launch();
const staffPage = await browser.newPage({ viewport: { width: 1400, height: 900 } });
staffPage.setDefaultTimeout(75000);
staffPage.setDefaultNavigationTimeout(75000);
const errors = [];
staffPage.on("console", (msg) => msg.type() === "error" && errors.push(`[staff] ${msg.text()}`));
staffPage.on("pageerror", (err) => errors.push(`[staff] ${err}`));

await staffPage.goto(`${BASE}/login`);
await staffPage.getByLabel("Email").fill(EMAIL);
await staffPage.getByLabel("Password").fill(PASSWORD);
await staffPage.getByRole("button", { name: "Sign in" }).click();
await staffPage.waitForURL((url) => url.pathname === "/select-financial-year" || url.pathname === "/", {
  timeout: 75000,
});
if (staffPage.url().includes("select-financial-year")) {
  await staffPage.getByRole("button", { name: "Continue" }).click();
  await staffPage.waitForURL(`${BASE}/`, { timeout: 75000 });
}

await staffPage.goto(`${BASE}/billing`);
await staffPage.waitForSelector("text=New Bill", { timeout: 30000 });
await staffPage.waitForTimeout(1200);
const continueBtn = staffPage.getByRole("button", { name: /^Continue$/ });
if ((await continueBtn.count()) > 0) {
  await staffPage.getByText(/Select terminal/i).first().click();
  await staffPage.waitForTimeout(500);
  await staffPage.locator('[role="option"], [data-slot="command-item"], [cmdk-item]').first().click();
  await staffPage.waitForTimeout(300);
  await continueBtn.click();
  await staffPage.waitForTimeout(1200);
}

const productsRes = await staffPage.request.get(`${BASE}/api/products?pageSize=5`);
const productName = (await productsRes.json()).data?.[0]?.name;
const scanInput = staffPage.getByPlaceholder(/Scan or search/i);
await scanInput.click();
await scanInput.fill(productName);
await staffPage.waitForTimeout(2500);
const firstResult = staffPage
  .locator('[role="option"], li, [data-slot="command-item"], tr, button')
  .filter({ hasText: productName })
  .first();
if ((await firstResult.count()) > 0) await firstResult.click();
await staffPage.waitForResponse(
  (res) => res.url().includes("/api/bills/preview") && res.request().method() === "POST",
  { timeout: 60000 },
);
await staffPage.waitForTimeout(500);

await staffPage.getByRole("checkbox", { name: /Collect via QR/i }).click({ timeout: 60000 });
await staffPage.waitForTimeout(300);
await staffPage.getByRole("button", { name: /Proceed to payment/i }).click();
await staffPage.waitForURL(/\/billing\/.+\/collect/, { timeout: 30000 });
console.log("navigated to collect page:", staffPage.url());

await staffPage.getByRole("button", { name: "Payment Link" }).click();
await staffPage.getByRole("button", { name: "Request payment" }).click();
const createRes = await staffPage.waitForResponse(
  (res) => res.url().includes("/payment-requests") && res.request().method() === "POST",
  { timeout: 30000 },
);
const createBody = await createRes.json();
console.log("gatewayReference (stub mode, should be non-null immediately):", createBody.gatewayReference);
await staffPage.waitForTimeout(800);

const linkText = await staffPage.locator("p.bg-muted").first().textContent();
console.log("payment link:", linkText);

const customerContext = await browser.newContext();
const customerPage = await customerContext.newPage();
customerPage.on("console", (msg) => msg.type() === "error" && errors.push(`[customer] ${msg.text()}`));
customerPage.on("pageerror", (err) => errors.push(`[customer] ${err}`));

const [payInfoRes] = await Promise.all([
  customerPage.waitForResponse(
    (res) => res.url().includes("/api/pay/") && res.request().method() === "GET",
    { timeout: 30000 },
  ),
  customerPage.goto(linkText.trim()),
]);
console.log("pay-info response status:", payInfoRes.status());
const payInfoBody = await payInfoRes.json().catch(() => null);
console.log("checkoutUrl (stub mode, should be null):", payInfoBody?.checkoutUrl);
await customerPage.waitForTimeout(1000);

await customerPage.getByRole("button", { name: "Pay Now" }).click();
await customerPage.waitForResponse((res) => res.url().includes("/complete"), { timeout: 30000 });
await customerPage.waitForTimeout(1000);
const customerBodyAfter = await customerPage.textContent("body");
console.log("customer page shows 'Payment received':", customerBodyAfter.includes("Payment received"));

await staffPage.waitForTimeout(12000);
const staffBodyAfter = await staffPage.textContent("body");
console.log("\nstaff page shows 'Payment received':", staffBodyAfter.includes("Payment received"));
await staffPage.screenshot({ path: "c:/projects/POS/tmp-lazy-link-final.png" });

console.log("\nerrors:", errors.length ? errors.join("\n") : "(none)");
await browser.close();
