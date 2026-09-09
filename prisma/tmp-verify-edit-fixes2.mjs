import { chromium } from "playwright";

const EMAIL = "tmp-nav-test@example.com";
const PASSWORD = "TmpNavTest123!";
const PRODUCT_ID = "49313860-3049-46b0-abef-f1a8302ff106";
const WAREHOUSE_1 = "941decd2-e259-45c3-be23-389523203899";
const CUSTOMER_ID = "3cb2726b-d010-4c2c-a418-274edad95edd";
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

  console.log("=== Create + complete a bill with an existing customer ===");
  const createRes = await api("POST", "/api/bills", {
    billType: "credit_bill",
    billDate: new Date().toISOString().slice(0, 10),
    terminalId: TERMINAL_ID,
    excludeTax: false,
  });
  const billId = createRes.json?.id;
  await api("PATCH", `/api/bills/${billId}`, { customerId: CUSTOMER_ID });
  await api("POST", `/api/bills/${billId}/lines`, {
    productId: PRODUCT_ID,
    quantity: 1,
    allocations: [{ warehouseId: WAREHOUSE_1, quantity: 1 }],
  });
  await api("POST", `/api/bills/${billId}/complete`, {});
  console.log("billId:", billId);

  console.log("\n=== Load for edit ===");
  await page.goto(`http://localhost:3000/billing?billId=${billId}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(1500);

  const excludeTaxDisabled = await page.locator("#exclude-tax").isDisabled().catch(() => "n/a");
  console.log("Exclude tax checkbox disabled (expect false):", excludeTaxDisabled);

  const customerLabelBefore = await page
    .locator("#billing-existing-customer-select")
    .textContent()
    .catch(() => null);
  console.log("Customer field label BEFORE editing address:", customerLabelBefore);

  const addressInput = page.locator("label", { hasText: "Address" }).locator("..").locator("input");
  const addressCount = await addressInput.count();
  console.log("Address input found:", addressCount);
  if (addressCount > 0) {
    await addressInput.fill("123 Test Street");
    await page.waitForTimeout(500);
  }

  const customerLabelAfter = await page
    .locator("#billing-existing-customer-select")
    .textContent()
    .catch(() => null);
  console.log("Customer field label AFTER editing address (expect UNCHANGED):", customerLabelAfter);
  console.log(
    "PASS:",
    customerLabelBefore === customerLabelAfter && !customerLabelAfter?.includes("Select customer"),
  );

  await page.screenshot({ path: "prisma/tmp-verify-edit-fixes2.png", fullPage: true });

  console.log("\n=== Cleanup ===");
  const billRes = await api("GET", `/api/bills/${billId}`);
  const lineId = billRes.json?.lines?.find((l) => l.status === "active")?.id;
  if (lineId) {
    const delRes = await api("DELETE", `/api/bills/${billId}/lines/${lineId}`);
    console.log("cleanup delete line:", delRes.status);
  }

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
