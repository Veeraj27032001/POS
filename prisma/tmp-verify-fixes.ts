import { chromium } from "playwright";

import { unscoped } from "@/lib/db";

const BASE = "http://localhost:3100";

async function loginAs(page: import("playwright").Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/select-financial-year|\/$/, { timeout: 20000 });
  if (page.url().includes("select-financial-year")) {
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("**/", { timeout: 20000 });
  }
}

async function main() {
  const browser = await chromium.launch();
  const results: Record<string, unknown> = {};

  // --- Part 1: Stock Ledger fix, as the store-scoped Admin ---
  {
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await loginAs(page, "veerajshetty27032001@gmail.com", "Veeraj@27");

    await page.goto(`${BASE}/reports/stock-ledger`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Select a store card (first one)
    const storeCards = page.locator("button[aria-pressed]");
    await storeCards.first().click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: "prisma/tmp-stock-ledger.png", fullPage: true });

    // Open the FY select and count options
    await page.getByRole("button", { name: "Financial year" }).click();
    await page.waitForTimeout(500);
    const fyOptions = await page.locator('[role="option"], [cmdk-item]').allTextContents();
    results.fyOptions = fyOptions;

    if (fyOptions.length > 0) {
      await page.locator('[role="option"], [cmdk-item]').first().click();
    }
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Warehouse" }).click();
    await page.waitForTimeout(500);
    const whOptions = await page.locator('[role="option"], [cmdk-item]').allTextContents();
    results.warehouseOptions = whOptions;
    if (whOptions.length > 0) {
      await page.locator('[role="option"], [cmdk-item]').first().click();
    }
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Product", exact: true }).click();
    await page.waitForTimeout(500);
    const prodOptionsEls = page.locator('[role="option"], [cmdk-item]');
    const prodCount = await prodOptionsEls.count();
    if (prodCount > 0) {
      await prodOptionsEls.first().click();
    }
    await page.waitForTimeout(2000);

    const bodyText = await page.locator("body").innerText();
    results.ledgerHasNotFoundError = bodyText.includes("not found");
    results.ledgerHasOpeningBalance = bodyText.includes("Opening balance");
    results.ledgerConsoleErrors = consoleErrors;
    await page.screenshot({ path: "prisma/tmp-stock-ledger-loaded.png", fullPage: true });

    // Confirm E-commerce nav item is gone for this store-scoped Admin
    results.adminSeesEcommerceNav = bodyText.includes("E-commerce");
    const directNavRes = await page.goto(`${BASE}/settings/ecommerce`, {
      waitUntil: "networkidle",
    });
    results.adminDirectNavStatus = directNavRes?.status();
    const directNavBody = await page.locator("body").innerText();
    results.adminDirectNavBlocked =
      directNavBody.includes("don't have permission") ||
      directNavBody.includes("Forbidden") ||
      directNavBody.includes("not authorized") ||
      directNavBody.includes("Unauthorized");
    results.adminDirectNavSnippet = directNavBody.slice(0, 200);

    await page.close();
  }

  // --- Part 2: Super Admin should still have full access ---
  {
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await loginAs(page, "veerajshetty2001@gmail.com", "Veeraj@27");

    await page.goto(`${BASE}/settings/ecommerce`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const bodyText = await page.locator("body").innerText();
    results.superAdminSeesEcommercePage = bodyText.includes("E-commerce");
    results.superAdminConsoleErrorsBeforeStore = consoleErrors.slice();

    const storeCards = page.locator("button[aria-pressed]");
    const cardCount = await storeCards.count();
    results.superAdminStoreCardCount = cardCount;
    if (cardCount > 0) {
      await storeCards.first().click();
      await page.waitForTimeout(1000);

      await page.getByRole("button", { name: "New credential" }).click();
      await page.getByPlaceholder("e.g. My Shopify Store").fill("RBAC Verify Credential");
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await page.waitForTimeout(1000);
      const apiKey = await page.locator("input[readonly]").nth(0).inputValue();
      results.superAdminCreatedApiKey = apiKey;
      await page.getByRole("button", { name: "Done" }).click();
      await page.waitForTimeout(500);

      // Revoke it
      const revokeButtons = page.getByRole("button", { name: "Revoke" });
      if ((await revokeButtons.count()) > 0) {
        await revokeButtons.first().click();
        await page.waitForTimeout(1000);
      }
      const afterRevokeText = await page.locator("body").innerText();
      results.superAdminSeesRevoked = afterRevokeText.includes("Revoked");
    }

    results.superAdminConsoleErrors = consoleErrors;
    await page.screenshot({ path: "prisma/tmp-superadmin-ecommerce.png", fullPage: true });
    await page.close();
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  await unscoped().$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
