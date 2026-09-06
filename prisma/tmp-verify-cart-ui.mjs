import { chromium } from "playwright";

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

await page.goto("http://localhost:3200/", { waitUntil: "networkidle" });
await page.screenshot({ path: "prisma/tmp-cart-ui-1-home.png" });

// Add the first two distinct products to cart via their "Add to cart" buttons.
const addButtons = page.getByRole("button", { name: "Add to cart" });
const count = await addButtons.count();
console.log("Add to cart buttons found:", count);
await addButtons.nth(0).click();
await page.waitForTimeout(800);
await addButtons.nth(1).click();
await page.waitForTimeout(800);

await page.goto("http://localhost:3200/cart", { waitUntil: "networkidle" });
await page.screenshot({ path: "prisma/tmp-cart-ui-2-cart.png" });
const cartText = await page.locator("body").innerText();
const lineCount = (cartText.match(/₹/g) || []).length;
console.log("cart page mentions ₹ this many times (sanity, expect >=2):", lineCount);

// Bump the first line's quantity with the + button.
const plusButtons = page.getByRole("button", { name: "+" });
await plusButtons.first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: "prisma/tmp-cart-ui-3-after-plus.png" });

// Checkout.
await page.getByRole("button", { name: "Checkout" }).click();
await page.waitForURL(/\/pay/, { timeout: 15000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: "prisma/tmp-cart-ui-4-pay.png" });
const payText = await page.locator("body").innerText();

// Cancel (safe path — releases locks, no real payment).
await page.getByRole("button", { name: "Cancel" }).click();
await page.waitForURL(/cancelled=1/, { timeout: 15000 });
await page.screenshot({ path: "prisma/tmp-cart-ui-5-cancelled.png" });

console.log(JSON.stringify({
  finalUrl: page.url(),
  payPageHadTotal: payText.includes("Total"),
  consoleErrors,
}, null, 2));

await browser.close();
