import { chromium } from "playwright";

const EMAIL = "tmp-nav-test@example.com";
const PASSWORD = "TmpNavTest123!";
const PRODUCT_ID = "49313860-3049-46b0-abef-f1a8302ff106";
const WAREHOUSE_1 = "941decd2-e259-45c3-be23-389523203899";
const CUSTOMER_ID = "3cb2726b-d010-4c2c-a418-274edad95edd";
const TERMINAL_ID = "4466b16d-1a61-4b31-bf01-c37da89b2c2d";
const REASON_CODE_ID = "83343303-57cd-435f-b3a4-55fcfa05c0fb";

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

  console.log("=== Setup: small clean buffer (+10) so numbers are legible ===");
  await api("POST", "/api/stock-positive-adjustments", {
    warehouseId: WAREHOUSE_1,
    adjustmentDate: new Date().toISOString().slice(0, 10),
    items: [{ productId: PRODUCT_ID, quantity: 10, reasonCodeId: REASON_CODE_ID }],
  });

  console.log("\n=== Create + complete a credit_bill with qty 3 ===");
  const createRes = await api("POST", "/api/bills", {
    billType: "credit_bill",
    billDate: new Date().toISOString().slice(0, 10),
    terminalId: TERMINAL_ID,
    excludeTax: true,
  });
  const billId = createRes.json?.id;
  await api("PATCH", `/api/bills/${billId}`, { customerId: CUSTOMER_ID });
  const addRes = await api("POST", `/api/bills/${billId}/lines`, {
    productId: PRODUCT_ID,
    quantity: 3,
    allocations: [{ warehouseId: WAREHOUSE_1, quantity: 3 }],
  });
  const lineId = addRes.json?.line?.id;
  await api("POST", `/api/bills/${billId}/complete`, {});
  console.log("billId:", billId, "lineId:", lineId);

  console.log("\n=== TEST 1: preview endpoint self-exclusion for a completed bill ===");
  const previewNoBillId = await api("POST", "/api/bills/preview", {
    lines: [{ productId: PRODUCT_ID, quantity: 3, discountApplied: 0 }],
    excludeTax: true,
  });
  const availWithoutSelf = previewNoBillId.json?.lines?.[0]?.warehouseAvailability?.find(
    (w) => w.warehouseId === WAREHOUSE_1,
  )?.available;
  console.log("Available WITHOUT billId (raw, no self-exclusion):", availWithoutSelf);

  const previewWithBillId = await api("POST", "/api/bills/preview", {
    billId,
    lines: [{ productId: PRODUCT_ID, quantity: 3, discountApplied: 0 }],
    excludeTax: true,
  });
  const availWithSelf = previewWithBillId.json?.lines?.[0]?.warehouseAvailability?.find(
    (w) => w.warehouseId === WAREHOUSE_1,
  )?.available;
  console.log("Available WITH billId (should add back this line's own 3):", availWithSelf);
  console.log(
    "PASS (self-exclusion adds back exactly 3):",
    availWithSelf === availWithoutSelf + 3,
  );

  console.log("\n=== TEST 2: product-availability route self-exclusion ===");
  const prodAvail = await api("POST", "/api/bills/product-availability", {
    productIds: [PRODUCT_ID],
    billId,
  });
  console.log("product-availability result:", JSON.stringify(prodAvail.json));

  console.log("\n=== TEST 3: credit_bill edit should NOT redirect to Collect ===");
  await page.goto(`http://localhost:3000/billing?billId=${billId}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(1500);

  const cartQtyInput = page.locator('table input[type="number"]').first();
  const before = await cartQtyInput.inputValue();
  console.log("Qty before:", before);
  await cartQtyInput.fill("5");
  await cartQtyInput.blur();
  await page.waitForTimeout(800);

  const saveBtn = page.locator('button:has-text("Save changes")').first();
  await saveBtn.click();
  await page.waitForTimeout(2500);
  const finalUrl = page.url();
  console.log("URL after Save changes on credit_bill (expect /bills/..., NOT /billing/.../collect):", finalUrl);
  console.log("PASS (did not redirect to collect):", !finalUrl.includes("/collect"));

  console.log("\n=== Cleanup ===");
  const delRes = await api("DELETE", `/api/bills/${billId}/lines/${lineId}`);
  console.log("remove line:", delRes.status);
  await api("POST", "/api/stock-negative-adjustments", {
    warehouseId: WAREHOUSE_1,
    adjustmentDate: new Date().toISOString().slice(0, 10),
    items: [{ productId: PRODUCT_ID, quantity: 10, reasonCodeId: REASON_CODE_ID }],
  });

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
