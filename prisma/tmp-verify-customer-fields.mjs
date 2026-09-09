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

  await page.goto(`${BASE}/billing`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  await page.getByText("Select terminal…").click();
  await page.waitForTimeout(300);
  await page.getByRole("option").first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.waitForTimeout(2000);

  // No cart line this time — isolate the customer-fields area cleanly.
  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-kbd-item]")).map((el, i) => ({
      i,
      tag: el.tagName,
      type: el.getAttribute("type"),
      role: el.getAttribute("role"),
      text: el.textContent?.trim().slice(0, 20),
    })),
  );
  console.log("Full tracked item list (no cart line):");
  for (const it of items) console.log(`  [${it.i}] ${it.tag} type=${it.type ?? ""} role=${it.role ?? ""} "${it.text ?? ""}"`);

  const nameIdx = items.findIndex((it) => it.tag === "BUTTON" && it.text === "Select customer…") + 1;
  console.log("\nStarting walk from index", nameIdx, "(Name field)");
  await page.evaluate((idx) => {
    document.querySelectorAll("[data-kbd-item]")[idx].focus();
  }, nameIdx);
  await page.waitForTimeout(200);

  for (let step = 0; step < 8; step++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => {
      const a = document.activeElement;
      const all = Array.from(document.querySelectorAll("[data-kbd-item]"));
      return {
        tag: a?.tagName,
        type: a?.getAttribute?.("type"),
        text: a?.textContent?.trim().slice(0, 20),
        index: all.indexOf(a),
        totalItems: all.length,
      };
    });
    console.log(`  step ${step}: index=${state.index}/${state.totalItems} ${state.tag} type=${state.type ?? ""} "${state.text ?? ""}"`);
  }

  await browser.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
