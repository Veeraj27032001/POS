import { config } from "dotenv";
config({ path: ".env.local" });

const { getStockLevels } = await import("../lib/stock/getStockLevels.ts");
const { chromium } = await import("playwright");

const EMAIL = "tmp-nav-test@example.com";
const PASSWORD = "TmpNavTest123!";
const PRODUCT_ID = "49313860-3049-46b0-abef-f1a8302ff106";
const WAREHOUSE_1 = "941decd2-e259-45c3-be23-389523203899";
const CUSTOMER_ID = "3cb2726b-d010-4c2c-a418-274edad95edd";
const TERMINAL_ID = "4466b16d-1a61-4b31-bf01-c37da89b2c2d";
const REASON_CODE_ID = "83343303-57cd-435f-b3a4-55fcfa05c0fb";

async function level(label) {
  const l1 = await getStockLevels({ productId: PRODUCT_ID, warehouseId: WAREHOUSE_1 });
  console.log(`[stock] ${label} — wh1 available=${l1.available}`);
  return l1.available;
}

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

  console.log("=== Setup: clean buffer of +100 at wh1 ===");
  await api("POST", "/api/stock-positive-adjustments", {
    warehouseId: WAREHOUSE_1,
    adjustmentDate: new Date().toISOString().slice(0, 10),
    items: [{ productId: PRODUCT_ID, quantity: 100, reasonCodeId: REASON_CODE_ID }],
  });
  const base = await level("baseline after buffer");

  console.log("\n=== Create + complete a bill with qty 3 ===");
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
  await level("after completing with qty=3 (expect base - 3)");

  console.log("\n=== Now edit via the REAL /billing?billId= UI: increase 3 -> 4 ===");
  await page.goto(`http://localhost:3000/billing?billId=${billId}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(1500);

  const bodyText = await page.locator("body").innerText();
  console.log("Has 'Save changes' button:", bodyText.includes("Save changes"));
  console.log("Has Payment card:", bodyText.includes("Payment"));
  console.log(
    "Bill Type buttons disabled (locked):",
    await page.locator("#billing-bill-type-cash").isDisabled().catch(() => "n/a"),
  );

  const qtyInput = page.locator('input[type="number"]').filter({ hasNot: page.locator('[id]') });
  const allNumberInputs = await page.locator('input[type="number"]').count();
  console.log("Number inputs on page:", allNumberInputs);

  // Find the cart line's quantity input specifically (EditableLineValue).
  const cartQtyInput = page.locator('input[type="number"]').last();
  const currentVal = await cartQtyInput.inputValue().catch(() => null);
  console.log("Cart line qty input current value:", currentVal);

  if (currentVal === "3") {
    await cartQtyInput.fill("4");
    await cartQtyInput.blur();
    await page.waitForTimeout(800);
  }

  const saveBtn = page.locator('button:has-text("Save changes")').first();
  const saveBtnCount = await saveBtn.count();
  console.log("Save changes button found:", saveBtnCount);
  if (saveBtnCount > 0) {
    await saveBtn.click();
    await page.waitForTimeout(2500);
    console.log("URL after Save changes:", page.url());
  }

  await level("after UI-driven increase to 4 (expect base - 4)");

  console.log("\n=== Cleanup: remove the test line, then reverse the +100 buffer ===");
  const removeRes = await api("DELETE", `/api/bills/${billId}/lines/${lineId}`);
  console.log("remove line:", removeRes.status);
  await level("after removing the line (expect back to full baseline)");
  await api("POST", "/api/stock-negative-adjustments", {
    warehouseId: WAREHOUSE_1,
    adjustmentDate: new Date().toISOString().slice(0, 10),
    items: [{ productId: PRODUCT_ID, quantity: 100, reasonCodeId: REASON_CODE_ID }],
  });

  console.log("billId for reference:", billId);
  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
