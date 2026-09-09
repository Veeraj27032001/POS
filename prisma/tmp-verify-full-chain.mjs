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
  // Generous settle time so the cart line + preview fetch fully resolve
  // before the walk starts — real users don't arrow-key at 80ms cadence
  // through a mid-render page.
  await page.waitForTimeout(3000);

  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-kbd-item]")).map((el, i) => ({
      i, tag: el.tagName, type: el.getAttribute("type"), text: el.textContent?.trim().slice(0, 25), ph: el.getAttribute("placeholder"),
    })),
  );
  console.log(`Total tracked items (with 1 cart line): ${items.length}`);
  for (const it of items) console.log(`  [${it.i}] ${it.tag} type=${it.type ?? ""} "${it.text ?? it.ph ?? ""}"`);

  const dateIdx = items.findIndex((it) => it.type === "date");
  await page.evaluate((idx) => document.querySelectorAll("[data-kbd-item]")[idx].focus(), dateIdx);
  await page.waitForTimeout(300);

  console.log("\nRealistic-paced walk from Bill Date to the end (400ms between presses):");
  for (let step = 0; step < items.length; step++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => {
      const a = document.activeElement;
      const all = Array.from(document.querySelectorAll("[data-kbd-item]"));
      return { tag: a?.tagName, type: a?.getAttribute?.("type"), text: a?.textContent?.trim().slice(0, 25) || a?.getAttribute?.("placeholder"), index: all.indexOf(a), total: all.length };
    });
    console.log(`  step ${step}: index=${state.index}/${state.total} ${state.tag} type=${state.type ?? ""} "${state.text ?? ""}"`);
  }

  await browser.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
