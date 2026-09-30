import { chromium } from "playwright";

const OUT = "C:/projects/POS/tmp-theme";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });

await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/login.png` });

await page.fill('input[name="email"]', "prinsonsilvancardoza@gmail.com");
await page.fill('input[name="password"]', "prinson@123");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 90000 }).catch(() => {});
if (page.url().includes("/select-financial-year")) {
  const btn = page.locator('button:has-text("Continue")').first();
  await btn.waitFor({ state: "visible", timeout: 30000 });
  for (let i = 0; i < 20; i++) {
    if (!(await btn.isDisabled())) break;
    await page.waitForTimeout(1000);
  }
  await btn.click();
  await page.waitForURL((u) => !u.pathname.includes("/select-financial-year"), { timeout: 30000 }).catch(() => {});
}

for (const [name, path] of [
  ["dashboard", "/"],
  ["stores", "/stores"],
  ["products", "/products"],
  ["billing", "/billing"],
]) {
  await page.goto(`http://localhost:3000${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 20; i++) {
    const busy = await page
      .evaluate(() => document.querySelectorAll('.animate-pulse, [role="status"]').length)
      .catch(() => 1);
    if (busy === 0) break;
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("ok", name);
}

await browser.close();
