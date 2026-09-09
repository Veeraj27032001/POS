import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
const BARCODE = "2065893380452";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

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
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForURL((u) => !u.pathname.includes("select-financial-year"), { timeout: 30000 });
    await page.waitForLoadState("networkidle");
  }

  await page.goto(`${BASE}/billing`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.getByText("Select terminal…").click();
  await page.waitForTimeout(300);
  await page.getByRole("option").first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.waitForTimeout(1500);

  const scanBox = page.locator('input[placeholder*="scan" i]').first();
  await scanBox.click();
  await page.keyboard.type(BARCODE);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);

  // Open the Warehouse split dialog via keyboard: focus the trigger, press Enter.
  const trigger = page.locator('button:has-text("Choose warehouses"), button:has-text(":")').first();
  await trigger.focus();
  await page.waitForTimeout(150);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);

  const dialogOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
  console.log("Dialog open:", dialogOpen);

  const items = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    return Array.from(dialog.querySelectorAll("[data-kbd-item]")).map((el, i) => ({
      i, tag: el.tagName, type: el.getAttribute("type"), text: el.textContent?.trim().slice(0, 20),
    }));
  });
  console.log("Dialog tracked items:", JSON.stringify(items));

  if (items.length > 0) {
    await page.evaluate(() => {
      document.querySelector('[role="dialog"]').querySelectorAll("[data-kbd-item]")[0].focus();
    });
    await page.waitForTimeout(200);
    for (let step = 0; step < items.length + 1; step++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => {
        const a = document.activeElement;
        const dialog = document.querySelector('[role="dialog"]');
        const all = dialog ? Array.from(dialog.querySelectorAll("[data-kbd-item]")) : [];
        return { tag: a?.tagName, text: a?.textContent?.trim().slice(0, 20), index: all.indexOf(a) };
      });
      console.log(`  step ${step}: index=${state.index} ${state.tag} "${state.text ?? ""}"`);
    }
  }

  await browser.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
