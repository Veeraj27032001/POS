import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "C:/projects/POS/tmp-shots";
mkdirSync(OUT, { recursive: true });

// List / report pages.
const SCREENS = [
  ["01-stores", "/stores"],
  ["02-storage", "/warehouses"],
  ["03-terminals", "/terminals"],
  ["04-numbering", "/numbering-series"],
  ["05-payment-methods", "/payment-methods"],
  ["06-reason-codes", "/reason-codes"],
  ["07-hsn-codes", "/settings/hsn-codes"],
  ["08-tax-engine", "/settings/tax-engine"],
  ["09-bill-formats", "/bill-formats"],
  ["10-financial-years", "/settings/financial-years"],
  ["11-users", "/users"],
  ["12-roles", "/settings/roles"],
  ["13-ecommerce", "/settings/ecommerce"],
  ["14-desktop-app", "/desktop-app"],
  ["20-dashboard", "/"],
  ["21-categories", "/categories"],
  ["22-uoms", "/uoms"],
  ["23-products", "/products"],
  ["24-barcodes", "/barcodes/system"],
  ["25-customers", "/customers"],
  ["26-suppliers", "/suppliers"],
  ["27-product-requests", "/product-requests"],
  ["28-stock-inward", "/stock-inwards"],
  ["29-stock-damage", "/stock-damages"],
  ["30-stock-block", "/stock-blocks"],
  ["31-stock-transfer", "/stock-transfers"],
  ["32-opening-balance", "/stock-openings"],
  ["33-positive-adj", "/stock-positive-adjustments"],
  ["34-negative-adj", "/stock-negative-adjustments"],
  ["35-quality-check", "/stock-quality-checks"],
  ["36-low-stock", "/low-stock"],
  ["37-billing", "/billing"],
  ["38-bills", "/bills"],
  ["39-returns", "/bill-returns"],
  ["40-credit-notes", "/credit-notes"],
  ["41-refunds", "/refunds"],
  ["42-shifts", "/shifts"],
  ["43-report-stock", "/reports/stock"],
  ["44-report-sales", "/reports/sales"],
  ["45-report-gst", "/reports/gst-summary"],
];

// Full-page entry forms.
const FORMS = [
  ["50-new-product-request", "/product-requests/new"],
  ["51-new-stock-inward", "/stock-inwards/new"],
  ["52-new-stock-damage", "/stock-damages/new"],
  ["53-new-stock-transfer", "/stock-transfers/new"],
  ["54-new-opening-balance", "/stock-openings/new"],
  ["55-new-positive-adj", "/stock-positive-adjustments/new"],
  ["56-new-negative-adj", "/stock-negative-adjustments/new"],
  ["57-new-quality-check", "/stock-quality-checks/new"],
  ["58-new-stock-block", "/stock-blocks/new"],
];

// Create dialogs: [name, path, button text]
const DIALOGS = [
  ["60-dlg-new-store", "/stores", "New"],
  ["61-dlg-new-storage", "/warehouses", "New"],
  ["62-dlg-new-terminal", "/terminals", "New"],
  ["63-dlg-new-user", "/users", "New User"],
  ["64-dlg-new-hsn", "/settings/hsn-codes", "New"],
  ["65-dlg-new-payment-method", "/payment-methods", "New"],
  ["66-dlg-new-reason-code", "/reason-codes", "New"],
  ["67-dlg-new-series", "/numbering-series", "New Series"],
  ["68-dlg-new-category", "/categories", "New"],
  ["69-dlg-new-uom", "/uoms", "New"],
  ["70-dlg-new-product", "/products", "New Product"],
  ["71-dlg-new-customer", "/customers", "New"],
  ["72-dlg-new-supplier", "/suppliers", "New"],
  ["73-dlg-new-bill-format", "/bill-formats", "New"],
];

// Waits until skeletons / spinners are gone, so no screenshot shows a
// half-loaded table.
async function waitForSettled(page, maxMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const busy = await page
      .evaluate(() => document.querySelectorAll('.animate-pulse, [role="status"]').length)
      .catch(() => 1);
    if (busy === 0) break;
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(5000);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });

  // Keep the Next.js dev overlay badges out of the manual screenshots.
  await page.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent =
      "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}";
    document.documentElement.appendChild(css);
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });

  // The sign-in form posts through React, so clicking before hydration sends a
  // plain GET with the credentials in the query string and never logs in.
  async function signIn() {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.goto("http://localhost:3000/login", {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      await page.waitForSelector('button[type="submit"]', { timeout: 30000 });
      await page.waitForTimeout(9000);
      if (attempt === 1) await page.screenshot({ path: `${OUT}/00-login.png` });

      await page.fill('input[name="email"]', "prinsonsilvancardoza@gmail.com");
      await page.fill('input[name="password"]', "prinson@123");
      await page.click('button[type="submit"]');
      await page
        .waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60000 })
        .catch(() => {});

      if (!page.url().includes("/login") && !page.url().includes("/unauthorized")) return true;
      console.log(`  sign-in attempt ${attempt} did not take, retrying`);
      await page.waitForTimeout(3000);
    }
    return false;
  }

  if (!(await signIn())) throw new Error("could not sign in");

  if (page.url().includes("/select-financial-year")) {
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/00b-financial-year.png` });
    const btn = page.locator('button:has-text("Continue")').first();
    await btn.waitFor({ state: "visible", timeout: 30000 });
    for (let i = 0; i < 20; i++) {
      if (!(await btn.isDisabled())) break;
      await page.waitForTimeout(1000);
    }
    await btn.click();
    await page
      .waitForURL((u) => !u.pathname.includes("/select-financial-year"), { timeout: 30000 })
      .catch(() => {});
  }
  await waitForSettled(page);

  for (const [name, path] of [...SCREENS, ...FORMS]) {
    try {
      await page.goto(`http://localhost:3000${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await waitForSettled(page);
      await page.screenshot({ path: `${OUT}/${name}.png` });
      console.log(`ok   ${name}`);
    } catch (e) {
      console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
    }
  }

  for (const [name, path, label] of DIALOGS) {
    try {
      await page.goto(`http://localhost:3000${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await waitForSettled(page);
      const btn = page.locator(`button:has-text("${label}")`).first();
      await btn.waitFor({ state: "visible", timeout: 20000 });
      await btn.click();
      await page.waitForTimeout(6000);
      await page.screenshot({ path: `${OUT}/${name}.png` });
      console.log(`ok   ${name}`);
    } catch (e) {
      console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
