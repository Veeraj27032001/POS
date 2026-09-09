import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];

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

  await page.goto(`${BASE}/bills`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  // Open the first bill's detail page.
  const firstRow = page.locator("tbody tr").first();
  await firstRow.click();
  await page.waitForURL(/\/bills\/[^/]+$/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-kbd-item]")).map((el, i) => ({
      i, tag: el.tagName, text: el.textContent?.trim().slice(0, 25),
    })),
  );
  console.log(`Bill Detail tracked items: ${items.length}`);
  for (const it of items) console.log(`  [${it.i}] ${it.tag} "${it.text ?? ""}"`);

  if (items.length === 0) {
    console.log("No tracked items found — aborting walk.");
    await browser.close();
    return;
  }

  await page.evaluate(() => document.querySelectorAll("[data-kbd-item]")[0].focus());
  await page.waitForTimeout(300);

  console.log("\nWalking ArrowRight from first item:");
  for (let step = 0; step < items.length + 1; step++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => {
      const a = document.activeElement;
      const all = Array.from(document.querySelectorAll("[data-kbd-item]"));
      return { tag: a?.tagName, text: a?.textContent?.trim().slice(0, 25), index: all.indexOf(a), total: all.length };
    });
    console.log(`  step ${step}: index=${state.index}/${state.total} ${state.tag} "${state.text ?? ""}"`);
  }

  // Test Left-arrow boundary: go back to item 0, then press Left to check it returns to the sidebar.
  await page.evaluate(() => document.querySelectorAll("[data-kbd-item]")[0].focus());
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  const afterLeft = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    href: document.activeElement?.getAttribute?.("href"),
    inNav: !!document.activeElement?.closest('nav[aria-label="Main navigation"]'),
  }));
  console.log("\nAfter ArrowLeft at first item (should return to sidebar):", JSON.stringify(afterLeft));

  await browser.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
