import { readFileSync } from "node:fs";

import { chromium } from "playwright";

import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";

const BASE = "http://localhost:3100";
const LOG = "/tmp/dev3100.log";
const TEST_PHONE = "9000000001";
const TEST_EMAIL = "storefront-test@example.com";

function latestOtpFromLog(phone: string): string | null {
  const log = readFileSync(LOG, "utf8");
  const matches = [
    ...log.matchAll(new RegExp(`\\[storefront-otp\\] code for ${phone}[^:]*: (\\d{6})`, "g")),
  ];
  return matches.length ? matches[matches.length - 1][1] : null;
}

async function main() {
  const db = unscoped();
  const results: Record<string, unknown> = {};
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // 1. Home page loads publicly with products
  await page.goto(`${BASE}/shop`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const productCards = page.locator('a[href^="/shop/products/"]');
  results.productCardCount = await productCards.count();
  await page.screenshot({ path: "prisma/tmp-shop-home.png", fullPage: true });

  // 2. Search filters
  await page.getByPlaceholder("Search products…").fill("Maggie");
  await page.waitForTimeout(2000);
  results.searchResultCount = await page.locator('a[href^="/shop/products/"]').count();
  await page.getByPlaceholder("Search products…").fill("");
  await page.waitForTimeout(1500);

  // 3. Open a product with stock
  const firstHref = await page.locator('a[href^="/shop/products/"]').first().getAttribute("href");
  const productId = firstHref!.split("/").pop()!;
  await page.goto(`${BASE}/shop/products/${productId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const detailText = await page.locator("body").innerText();
  results.detailShowsStock = /in stock|Out of stock/.test(detailText);
  await page.screenshot({ path: "prisma/tmp-shop-product.png", fullPage: true });

  const credential = await db.apiCredential.findFirst({
    where: { label: "Storefront Demo" },
    orderBy: { createdAt: "desc" },
  });
  const warehouse = await db.warehouse.findFirst({
    where: { storeId: credential!.storeId, isActive: true, isDeleted: false },
    orderBy: { name: "asc" },
  });
  const before = await getStockLevels({ productId, warehouseId: warehouse!.id });
  results.availableBefore = before.available;

  // 4. Add to cart -> lands on cart page
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.waitForURL("**/shop/cart", { timeout: 15000 });
  results.cartHasLine = (await page.locator("body").innerText()).includes("Total:");
  await page.screenshot({ path: "prisma/tmp-shop-cart.png", fullPage: true });

  // 5. Checkout redirects to login when signed out
  await page.getByRole("button", { name: "Checkout" }).click();
  await page.waitForURL("**/shop/login**", { timeout: 15000 });
  results.checkoutRedirectedToLogin = page.url().includes("/shop/login");

  // 6. OTP login
  await page.getByPlaceholder("9999999999").fill(TEST_PHONE);
  await page.getByPlaceholder("you@example.com").fill(TEST_EMAIL);
  await page.getByPlaceholder("Jane Doe").fill("Storefront Tester");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.waitForTimeout(3000);
  const code = latestOtpFromLog(TEST_PHONE);
  results.otpCodeFound = Boolean(code);
  if (!code) throw new Error("No OTP code appeared in the server log");
  await page.locator('input[maxlength="6"]').fill(code);
  await page.getByRole("button", { name: "Verify & sign in" }).click();
  await page.waitForURL("**/shop/checkout", { timeout: 15000 });
  results.signedInAndBackToCheckout = page.url().includes("/shop/checkout");

  // 7. Reserve stock, then CANCEL — stock must come back
  await page.getByRole("button", { name: /Reserve/ }).click();
  await page.waitForTimeout(4000);
  const duringLock = await getStockLevels({ productId, warehouseId: warehouse!.id });
  results.availableWhileLocked = duringLock.available;
  await page.screenshot({ path: "prisma/tmp-shop-payment.png", fullPage: true });

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForTimeout(3000);
  const afterCancel = await getStockLevels({ productId, warehouseId: warehouse!.id });
  results.availableAfterCancel = afterCancel.available;

  // 8. Reserve again and pay — order should be created, stock deducted
  await page.getByRole("button", { name: /Reserve/ }).click();
  await page.waitForTimeout(4000);
  await page.getByRole("button", { name: /^Pay ₹/ }).click();
  await page.waitForURL("**/shop/orders", { timeout: 20000 });
  await page.waitForTimeout(2000);
  const ordersText = await page.locator("body").innerText();
  results.ordersPageShowsOrder = /OB\d*\//.test(ordersText);
  const afterOrder = await getStockLevels({ productId, warehouseId: warehouse!.id });
  results.availableAfterOrder = afterOrder.available;
  await page.screenshot({ path: "prisma/tmp-shop-orders.png", fullPage: true });

  const order = await db.bill.findFirst({
    where: { billType: "online_bill" },
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });
  results.latestOnlineBill = {
    documentNumber: order?.documentNumber,
    status: order?.status,
    grandTotal: Number(order?.grandTotal),
    customerPhone: order?.customer?.phone,
  };

  // 9. Password login: set one, sign out, sign back in with it
  await page.goto(`${BASE}/shop/account`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator('input[type="password"]').fill("test-password-123");
  await page.getByRole("button", { name: "Save password" }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/shop", { timeout: 15000 });

  await page.goto(`${BASE}/shop/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Phone + password" }).click();
  await page.getByPlaceholder("9999999999").fill(TEST_PHONE);
  await page.locator('input[type="password"]').fill("test-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForTimeout(3000);
  const meRes = await page.request.get(`${BASE}/api/storefront/me`);
  const me = await meRes.json();
  results.passwordLoginWorked = Boolean(me.customer);

  results.consoleErrors = consoleErrors;

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
