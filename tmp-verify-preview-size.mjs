import { chromium } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: "c:/projects/POS/.env.local" });

const BASE = "http://localhost:3100";
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
const DESIGN_URL = "/bill-formats/232e2603-a646-4ce5-9ae4-86a49cb8ec22/design";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(60000);
page.setDefaultNavigationTimeout(60000);
const errors = [];
page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
page.on("pageerror", (err) => errors.push(String(err)));

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

await page.getByRole("button", { name: /^Preview$/ }).click();
await page.waitForResponse((res) => res.url().includes("/api/bill-formats/preview"), { timeout: 30000 });
await page.waitForTimeout(500);

const dialog = page.getByRole("dialog");
const box = await dialog.boundingBox();
console.log("dialog bounding box:", JSON.stringify(box));
console.log("viewport:", JSON.stringify(page.viewportSize()));

const iframeBox = await page.locator("iframe").boundingBox();
console.log("iframe bounding box:", JSON.stringify(iframeBox));

await page.screenshot({ path: "c:/projects/POS/tmp-preview-size.png" });

console.log("errors:", errors.length ? errors.join("\n") : "(none)");

await browser.close();
