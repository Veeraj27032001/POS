import { chromium } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: "c:/projects/POS/.env.local" });

const BASE = "http://localhost:3100";
const EMAIL = process.env.SEED_ADMIN2_EMAIL;
const PASSWORD = process.env.SEED_ADMIN2_PASSWORD;

const browser = await chromium.launch();

// --- Staff session: create a QR payment request ---
const staffPage = await browser.newPage({ viewport: { width: 1400, height: 900 } });
staffPage.setDefaultTimeout(60000);
staffPage.setDefaultNavigationTimeout(60000);
const staffErrors = [];
staffPage.on("console", (msg) => msg.type() === "error" && staffErrors.push(msg.text()));
staffPage.on("pageerror", (err) => staffErrors.push(String(err)));

await staffPage.goto(`${BASE}/login`);
await staffPage.getByLabel("Email").fill(EMAIL);
await staffPage.getByLabel("Password").fill(PASSWORD);
await staffPage.getByRole("button", { name: "Sign in" }).click();
await staffPage.waitForURL((url) => url.pathname === "/select-financial-year" || url.pathname === "/", {
  timeout: 60000,
});
if (staffPage.url().includes("select-financial-year")) {
  await staffPage.getByRole("button", { name: "Continue" }).click();
  await staffPage.waitForURL(`${BASE}/`, { timeout: 60000 });
}

await staffPage.goto(`${BASE}/billing`);
await staffPage.waitForSelector("text=New Bill", { timeout: 30000 });
await staffPage.waitForTimeout(1500);
const continueBtn = staffPage.getByRole("button", { name: /^Continue$/ });
if ((await continueBtn.count()) > 0) {
  await staffPage.getByText(/Select terminal/i).first().click();
  await staffPage.waitForTimeout(600);
  await staffPage.locator('[role="option"], [data-slot="command-item"], [cmdk-item]').first().click();
  await staffPage.waitForTimeout(300);
  await continueBtn.click();
  await staffPage.waitForTimeout(1500);
}

const productsRes = await staffPage.request.get(`${BASE}/api/products?pageSize=5`);
const productName = (await productsRes.json()).data?.[0]?.name;
const scanInput = staffPage.getByPlaceholder(/Scan or search/i);
await scanInput.click();
await scanInput.fill(productName);
await staffPage.waitForTimeout(3000);
const firstResult = staffPage
  .locator('[role="option"], li, [data-slot="command-item"], tr, button')
  .filter({ hasText: productName })
  .first();
if ((await firstResult.count()) > 0) await firstResult.click();
await staffPage.waitForTimeout(4000);

await staffPage.getByRole("button", { name: "Collect via QR / Link / Card" }).click();
await staffPage.waitForTimeout(500);
await staffPage.getByRole("button", { name: "Payment Link" }).click();
await staffPage.getByRole("button", { name: "Request payment" }).click();
await staffPage.waitForResponse(
  (res) => res.url().includes("/payment-requests") && res.request().method() === "POST",
  { timeout: 20000 },
);
await staffPage.waitForTimeout(800);

const linkText = await staffPage.locator("p.bg-muted").first().textContent();
console.log("payment link shown to staff:", linkText);

// --- Customer session: fresh, unauthenticated context ---
const customerContext = await browser.newContext();
const customerPage = await customerContext.newPage();
const customerErrors = [];
customerPage.on("console", (msg) => msg.type() === "error" && customerErrors.push(msg.text()));
customerPage.on("pageerror", (err) => customerErrors.push(String(err)));

await customerPage.goto(linkText.trim());
await customerPage.waitForTimeout(1500);
console.log("customer page URL after nav (should stay on /pay/, not redirect to /unauthorized):", customerPage.url());
const customerBody = await customerPage.textContent("body");
console.log("customer page shows amount:", /₹[\d.]+/.test(customerBody));
console.log("customer page has Pay Now button:", customerBody.includes("Pay Now"));
await customerPage.screenshot({ path: "c:/projects/POS/tmp-pay-page.png" });

await customerPage.getByRole("button", { name: "Pay Now" }).click();
await customerPage.waitForResponse((res) => res.url().includes("/complete"), { timeout: 20000 });
await customerPage.waitForTimeout(1000);
const customerBodyAfter = await customerPage.textContent("body");
console.log("customer page shows 'Payment received':", customerBodyAfter.includes("Payment received"));
await customerPage.screenshot({ path: "c:/projects/POS/tmp-pay-page-paid.png" });

// --- Back to staff: confirm the dialog picked it up via polling ---
await staffPage.waitForTimeout(4000);
const staffBodyAfter = await staffPage.textContent("body");
console.log("staff dialog closed / toast shown:", staffBodyAfter.includes("Payment received") || !staffBodyAfter.includes("Waiting for payment"));

console.log("\nstaff errors:", staffErrors.length ? staffErrors.join("\n") : "(none)");
console.log("customer errors:", customerErrors.length ? customerErrors.join("\n") : "(none)");
await browser.close();
