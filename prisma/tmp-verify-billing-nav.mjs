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

  // Add the item via the scan box.
  const scanBox = page.locator('input[placeholder*="scan" i], input[placeholder*="barcode" i]').first();
  await scanBox.click();
  await page.keyboard.type(BARCODE);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);

  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-kbd-item]")).map((el, i) => ({
      i,
      tag: el.tagName,
      type: el.getAttribute("type"),
      text: el.textContent?.trim().slice(0, 25),
      placeholder: el.getAttribute("placeholder"),
    })),
  );
  console.log("Full tracked item list:");
  for (const it of items) console.log(`  [${it.i}] ${it.tag} type=${it.type ?? ""} "${it.text ?? it.placeholder ?? ""}"`);

  // Find Bill Date field and start the walk from there.
  const dateIdx = items.findIndex((it) => it.type === "date");
  console.log("\nBill Date is at index", dateIdx);

  await page.evaluate((idx) => {
    document.querySelectorAll("[data-kbd-item]")[idx].focus();
  }, dateIdx);
  await page.waitForTimeout(100);

  console.log("\nWalking ArrowRight from Bill Date to the end:");
  let lastTag = "";
  for (let step = 0; step < items.length - dateIdx + 3; step++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(80);
    const state = await page.evaluate(() => {
      const a = document.activeElement;
      const all = Array.from(document.querySelectorAll("[data-kbd-item]"));
      return { tag: a?.tagName, type: a?.getAttribute?.("type"), text: a?.textContent?.trim().slice(0, 25), index: all.indexOf(a) };
    });
    console.log(`  step ${step}: index=${state.index} ${state.tag} type=${state.type ?? ""} "${state.text ?? ""}"`);
    if (state.tag === lastTag && state.index === -1) break;
    lastTag = state.tag;
  }

  await browser.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
