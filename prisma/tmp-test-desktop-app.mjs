import { chromium } from "playwright";
import path from "node:path";

const EMAIL = "tmp-desktop-superadmin@example.com";
const PASSWORD = "TmpDesktop123!";
const INSTALLER_PATH = path.resolve("electron/release/POS Setup 0.1.0.exe");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`[console:error] ${msg.text()}`);
  });

  await page.goto("http://localhost:3000/login");
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45000 });
  } catch {
    console.log("Still on /login after 45s wait — checking anyway.");
  }
  console.log("After login URL:", page.url());

  if (page.url().includes("/select-financial-year")) {
    // The page auto-selects the first financial year once the list loads —
    // just wait for Continue to enable, no dropdown interaction needed.
    const continueBtn = page.locator('button:has-text("Continue")').first();
    await continueBtn.waitFor({ state: "visible", timeout: 15000 });
    for (let i = 0; i < 15; i++) {
      if (!(await continueBtn.isDisabled())) break;
      await page.waitForTimeout(1000);
    }
    await continueBtn.click();
    try {
      await page.waitForURL((url) => !url.pathname.includes("/select-financial-year"), {
        timeout: 15000,
      });
    } catch {
      console.log("Still on select-financial-year after continue click.");
    }
    console.log("After FY select URL:", page.url());
  }

  await page.goto("http://localhost:3000/desktop-app");
  await page.waitForTimeout(2000);
  console.log("Desktop app page URL:", page.url());

  const uploadBtnCount = await page.locator('button:has-text("Upload new version")').count();
  console.log("Upload button visible (should be 1, Super Admin):", uploadBtnCount);

  await page.locator('button:has-text("Upload new version")').click();
  await page.waitForTimeout(500);

  await page.fill("#release-version", "0.1.0");
  await page.fill("#release-notes", "Test upload via Playwright verification.");
  await page.setInputFiles("#release-file", INSTALLER_PATH);

  await page.click('button[type="submit"]:has-text("Upload")');

  // Large file upload — poll for completion rather than a fixed wait.
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(2000);
    const toastText = await page.locator("[data-sonner-toast]").allTextContents();
    if (toastText.length > 0) {
      console.log(`[${i * 2}s] Toasts:`, JSON.stringify(toastText));
      break;
    }
  }

  await page.waitForTimeout(1500);
  const tableText = await page.locator("table").innerText().catch(() => "(no table)");
  console.log("Table contents:\n", tableText);

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
