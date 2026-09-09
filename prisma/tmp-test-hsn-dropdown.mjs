import { chromium } from "playwright";

const EMAIL = "veerajshetty2001@gmail.com";
const PASSWORD = "Veeraj@27";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`[console:error] ${msg.text()}`);
  });
  page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}`));

  await page.goto("http://localhost:3000/login");
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45000 });
  } catch {
    console.log("Still on /login after 45s wait.");
  }

  if (page.url().includes("/select-financial-year")) {
    const continueBtn = page.locator('button:has-text("Continue")').first();
    await continueBtn.waitFor({ state: "visible", timeout: 15000 });
    for (let i = 0; i < 15; i++) {
      if (!(await continueBtn.isDisabled())) break;
      await page.waitForTimeout(1000);
    }
    await continueBtn.click();
    try {
      await page.waitForURL((url) => !url.pathname.includes("/select-financial-year"), {
        timeout: 15000,
      });
    } catch {
      console.log("Still on select-financial-year after continue.");
    }
  }

  await page.goto("http://localhost:3000/products");
  await page.waitForTimeout(5000);
  console.log("Products page URL:", page.url());

  const sessionData = await page.evaluate(async () => {
    const res = await fetch("/api/auth/session");
    return res.json();
  });
  console.log("Session data:", JSON.stringify(sessionData, null, 2));

  const productsApiRes = await page.evaluate(async () => {
    const res = await fetch("/api/products?pageSize=10");
    return { status: res.status, body: await res.text() };
  });
  console.log("Products API:", JSON.stringify(productsApiRes).slice(0, 500));

  await page.goto(`http://localhost:3000/products/${JSON.parse(productsApiRes.body).data[0].id}`);
  await page.waitForTimeout(2500);
  console.log("Product detail URL:", page.url());

  const editBtn = page.locator('button:has-text("Edit")').first();
  await editBtn.waitFor({ state: "visible", timeout: 10000 });
  await editBtn.click();
  await page.waitForTimeout(1500);

  const dialogVisible = await page.locator('text="Edit Product"').count();
  console.log("Edit Product dialog visible:", dialogVisible);

  // Find HSN code select trigger specifically.
  const hsnLabel = page.locator("text=HSN code");
  const hsnLabelCount = await hsnLabel.count();
  console.log("HSN code label found:", hsnLabelCount);

  if (hsnLabelCount > 0) {
    // The SearchableSelect trigger should be near the label.
    const hsnTrigger = page
      .locator("div")
      .filter({ hasText: /^HSN code/ })
      .locator('button, [role="combobox"]')
      .first();
    const triggerCount = await hsnTrigger.count();
    console.log("HSN trigger count:", triggerCount);

    const startTime = Date.now();
    await hsnTrigger.click({ timeout: 10000 }).catch((e) => console.log("Click error:", e.message));
    console.log(`Click took ${Date.now() - startTime}ms`);
    await page.waitForTimeout(4000);

    const popoverVisible = await page.locator('[role="listbox"], [cmdk-list]').count();
    console.log("Popover/listbox visible after click:", popoverVisible);

    const itemCount = await page.locator('[cmdk-item]').count();
    console.log("Result items rendered:", itemCount);
    const itemTexts = await page.locator('[cmdk-item]').allTextContents();
    console.log("First few results:", JSON.stringify(itemTexts.slice(0, 5)));

    // Type a search query and confirm it narrows results.
    await page.fill('[cmdk-input]', "0101");
    await page.waitForTimeout(1500);
    const filteredCount = await page.locator('[cmdk-item]').count();
    console.log("Result items after typing '0101':", filteredCount);
    const filteredTexts = await page.locator('[cmdk-item]').allTextContents();
    console.log("Filtered results:", JSON.stringify(filteredTexts.slice(0, 10)));

    const bodyResponsive = await page
      .locator("body")
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    console.log("Body still responsive:", bodyResponsive);
  }

  await page.screenshot({ path: "prisma/tmp-hsn-stuck.png" });
  console.log("Screenshot saved.");

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
