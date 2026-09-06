import { chromium } from "playwright";

const BASE = "http://localhost:3100";

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill("veerajshetty27032001@gmail.com");
await page.getByLabel("Password").fill("Veeraj@27");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/select-financial-year|\/$/, { timeout: 20000 });
if (page.url().includes("select-financial-year")) {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/", { timeout: 20000 });
}

await page.waitForLoadState("networkidle");
await page.waitForTimeout(2000);

const bodyText = await page.locator("body").innerText();
const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
const hasErrorBoundary =
  bodyText.includes("Something went wrong") || bodyText.includes("Application error");

const widgetTitles = [
  "Today's Sales",
  "Low Stock Alerts",
  "Stale Stock Blocks",
  "Stale Held Bills",
  "Pending Transfers",
  "Credit Bill Outstanding",
];
const widgetsFound = widgetTitles.filter((t) => bodyText.includes(t));

await page.screenshot({ path: "prisma/tmp-dashboard.png", fullPage: true });

console.log(
  JSON.stringify(
    { scrollWidth, hasErrorBoundary, consoleErrors, widgetsFound, missing: widgetTitles.filter((t) => !widgetsFound.includes(t)) },
    null,
    2,
  ),
);

// also check mobile width
await page.setViewportSize({ width: 375, height: 800 });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const mobileScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
await page.screenshot({ path: "prisma/tmp-dashboard-mobile.png", fullPage: true });
console.log(JSON.stringify({ mobileScrollWidth }));

await browser.close();
