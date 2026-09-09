import { chromium } from "playwright";

const EMAIL = "tmp-desktop-superadmin@example.com";
const PASSWORD = "TmpDesktop123!";
const INSTALLER_PATH = "C:\\projects\\POS\\electron\\release\\POS Setup 0.1.0.exe";

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
    console.log("Still on /login after 45s wait.");
  }
  console.log("After login URL:", page.url());

  if (page.url().includes("/select-financial-year")) {
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
  }

  await page.goto("http://localhost:3000/desktop-app");
  await page.waitForTimeout(3000);
  console.log("Desktop app page URL:", page.url());

  await page.locator('button:has-text("Upload new version")').click();
  await page.waitForTimeout(500);

  await page.fill("#release-version", "0.1.0-filename-test2");
  await page.fill("#release-notes", "Verifying fixed clean download filename (no spaces).");
  await page.setInputFiles("#release-file", INSTALLER_PATH);

  const startTime = Date.now();
  await page.click('button[type="submit"]:has-text("Upload")');

  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(2000);
    const toastText = await page.locator("[data-sonner-toast]").allTextContents();
    if (toastText.length > 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[${elapsed}s] Toasts:`, JSON.stringify(toastText));
      break;
    }
  }

  await page.waitForTimeout(2000);
  const tableText = await page
    .locator("table")
    .innerText()
    .catch(() => "(no table)");
  console.log("Table contents:\n", tableText);

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
