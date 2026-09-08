import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];

const consoleErrors = [];

function logErrors(page) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });
  await page.waitForLoadState("networkidle");
  if (page.url().includes("select-financial-year")) {
    await page.getByRole("combobox").first().click();
    await page.waitForTimeout(500);
    await page.getByRole("option", { name: /2026-27/ }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "prisma/tmp-kbd-debug-fy.png" });
    await page.getByRole("button", { name: /^continue$/i }).click();
    try {
      await page.waitForURL((u) => !u.pathname.includes("select-financial-year"), {
        timeout: 30000,
      });
    } catch (e) {
      await page.screenshot({ path: "prisma/tmp-kbd-debug-fy-timeout.png" });
      console.log("FY continue body:", (await page.locator("body").innerText()).slice(0, 300));
      throw e;
    }
    await page.waitForLoadState("networkidle");
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  logErrors(page);

  console.log("=== Login ===");
  await login(page);
  console.log(`landed on: ${page.url()}`);

  console.log("\n=== Dashboard card grids (regression check) ===");
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("networkidle");
  const navcards = await page.locator("[data-navcard]").count();
  console.log(`data-navcard elements found: ${navcards}`);
  const firstCard = page.locator("[data-navcard]").first();
  await firstCard.focus();
  await page.keyboard.press("ArrowDown");
  const afterDown = await page.evaluate(() => document.activeElement?.textContent?.trim());
  console.log(`after ArrowDown from first navcard, focused element text: "${afterDown}"`);

  console.log("\n=== Sidebar Right-arrow: navigate then enter page ===");
  await page.goto(`${BASE}/products`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "prisma/tmp-kbd-1-products.png" });
  const billsLink = page.locator('nav[aria-label="Main navigation"] a[href="/bills"]');
  await billsLink.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForLoadState("networkidle");
  console.log(`after 1st ArrowRight on Bills link: ${page.url()}`);
  const focusedAfterNav = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    text: document.activeElement?.textContent?.trim().slice(0, 40),
  }));
  console.log(`focused element right after navigating: ${JSON.stringify(focusedAfterNav)}`);
  await page.keyboard.press("ArrowRight");
  const focusedAfter2ndRight = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    text: document.activeElement?.textContent?.trim().slice(0, 40),
  }));
  console.log(`focused element after 2nd ArrowRight (should be in page content): ${JSON.stringify(focusedAfter2ndRight)}`);
  await page.screenshot({ path: "prisma/tmp-kbd-2-bills-entered.png" });

  console.log("\n=== Bills list: arrow to a row, Enter opens it ===");
  // From wherever we are (New Bill link or search box), arrow down into rows.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("ArrowDown");
  }
  const onRow = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    hasKbdItem: document.activeElement?.hasAttribute("data-kbd-item"),
  }));
  console.log(`after several ArrowDown: ${JSON.stringify(onRow)}`);
  if (onRow.tag === "TR") {
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");
    console.log(`after Enter on a row: ${page.url()}`);
  } else {
    console.log("did not land on a TR row - skipping Enter-to-open check");
  }
  await page.screenshot({ path: "prisma/tmp-kbd-3-bill-detail-or-row.png" });

  console.log("\n=== ArrowLeft at first item returns to menu (Bills list) ===");
  await page.goto(`${BASE}/bills`);
  await page.waitForLoadState("networkidle");
  const newBillLink = page.locator('main [data-kbd-item]').first();
  await newBillLink.focus();
  await page.keyboard.press("ArrowLeft");
  const afterLeftBoundary = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    href: document.activeElement?.getAttribute("href"),
  }));
  console.log(`focus after ArrowLeft at first item: ${JSON.stringify(afterLeftBoundary)}`);

  console.log("\n=== ResourcePage master (Customers): Right into page, New dialog, Escape ===");
  await page.goto(`${BASE}/customers`);
  await page.waitForLoadState("networkidle");
  const customersLink = page.locator('nav[aria-label="Main navigation"] a[href="/customers"]');
  await customersLink.focus();
  await page.keyboard.press("ArrowRight");
  const focusedOnCustomers = await page.evaluate(() => document.activeElement?.textContent?.trim());
  console.log(`focused after entering Customers page: "${focusedOnCustomers}"`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const dialogVisible = await page.locator('[role="dialog"]').count();
  console.log(`dialog open after Enter on New button: ${dialogVisible > 0}`);
  if (dialogVisible > 0) {
    await page.screenshot({ path: "prisma/tmp-kbd-4-new-customer-dialog.png" });
    // Tab or arrow into the first field, type a bit, then Escape.
    await page.keyboard.press("Tab");
    await page.keyboard.type("Kbd Nav Test Customer");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const dialogAfterEscape = await page.locator('[role="dialog"]').count();
    console.log(`dialog open after Escape: ${dialogAfterEscape > 0}`);
  }

  console.log("\n=== Billing: land on it, scan box focused instantly ===");
  await page.goto(`${BASE}/billing`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const focusedOnBillingLoad = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    placeholder: document.activeElement?.getAttribute("placeholder"),
  }));
  console.log(`focus immediately on landing at /billing: ${JSON.stringify(focusedOnBillingLoad)}`);
  await page.screenshot({ path: "prisma/tmp-kbd-5-billing-landed.png" });

  console.log(
    `\nconsoleErrors so far (${consoleErrors.length}): ${JSON.stringify(consoleErrors.slice(0, 10))}`,
  );

  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FAILED:", err);
    console.log(`consoleErrors=${JSON.stringify(consoleErrors)}`);
    process.exit(1);
  });
