import { chromium } from "playwright";

const EMAIL = "tmp-nav-test@example.com";
const PASSWORD = "TmpNavTest123!";
const TERMINAL_ID = "4466b16d-1a61-4b31-bf01-c37da89b2c2d";
const COUNTRY_ID = "7a251e2a-1810-499d-8f91-8546ab13c4cc";
const STATE_ID = "7bacb04a-e83f-4f0e-9f0a-3e8512f765e1";

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

  console.log("=== Create a draft bill (no customer, walk-in) ===");
  const createRes = await api("POST", "/api/bills", {
    billType: "cash_bill",
    billDate: new Date().toISOString().slice(0, 10),
    terminalId: TERMINAL_ID,
    excludeTax: true,
  });
  const billId = createRes.json?.id;
  console.log("billId:", billId);

  console.log("\n=== POST customer-details: address/state/country/pincode, no name ===");
  const detailsRes = await api("POST", `/api/bills/${billId}/customer-details`, {
    name: "",
    phone: "",
    email: "",
    address: "123 Test Street",
    countryId: COUNTRY_ID,
    stateId: STATE_ID,
    pincode: "403001",
  });
  console.log("customer-details POST status:", detailsRes.status, JSON.stringify(detailsRes.json)?.slice(0, 300));

  console.log("\n=== GET the bill back (simulating resume load) ===");
  const getRes = await api("GET", `/api/bills/${billId}`);
  const b = getRes.json;
  console.log("customerAddress:", b?.customerAddress);
  console.log("customerCountryId:", b?.customerCountryId);
  console.log("customerStateId:", b?.customerStateId);
  console.log("customerPincode:", b?.customerPincode);
  console.log("customerId:", b?.customerId);
  console.log("customer object:", JSON.stringify(b?.customer));

  console.log("\n=== Cleanup ===");
  await api("DELETE", `/api/bills/${billId}`).catch(() => {});

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
