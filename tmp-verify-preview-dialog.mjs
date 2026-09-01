import { chromium } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: "c:/projects/POS/.env.local" });

const BASE = "http://localhost:3100";
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
const DESIGN_URL = "/bill-formats/232e2603-a646-4ce5-9ae4-86a49cb8ec22/design";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(60000);
page.setDefaultNavigationTimeout(60000);
const consoleErrors = [];
page.on("console", (msg) => msg.type() === "error" && consoleErrors.push(msg.text()));
page.on("pageerror", (err) => consoleErrors.push(String(err)));

await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password").fill(PASSWORD);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((url) => url.pathname === "/select-financial-year" || url.pathname === "/", {
  timeout: 60000,
});
if (page.url().includes("select-financial-year")) {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 60000 });
}

await page.goto(`${BASE}${DESIGN_URL}`);
await page.waitForSelector("text=Visual", { timeout: 30000 });
await page.waitForTimeout(1000);

// This format already has a saved design from the earlier verification run.
console.log("clicking preview...");
await page.getByRole("button", { name: /^Preview$/ }).click();
await page.waitForResponse((res) => res.url().includes("/api/bill-formats/preview"), { timeout: 30000 });
await page.waitForTimeout(500);

await page.screenshot({ path: "c:/projects/POS/tmp-preview-dialog-open.png", fullPage: true });
console.log("iframe visible:", await page.locator("iframe").isVisible());
console.log("dialog role visible:", await page.getByRole("dialog").isVisible());

// Confirm the editor (palette) is still there behind the dialog, and clicking
// close returns us to a fully interactive editor.
const closeBtn = page.getByRole("button", { name: /close/i }).first();
await closeBtn.click();
await page.waitForTimeout(500);
console.log("dialog still visible after close:", await page.getByRole("dialog").count());
console.log("palette clickable after close:", await page.locator("text=Store Header").isVisible());
await page.screenshot({ path: "c:/projects/POS/tmp-preview-dialog-closed.png", fullPage: true });

console.log("\nconsole/page errors:", consoleErrors.length ? consoleErrors.join("\n") : "(none)");

await browser.close();
