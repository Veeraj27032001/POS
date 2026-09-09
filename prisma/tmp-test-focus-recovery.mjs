import { chromium } from "playwright";

const EMAIL = "tmp-nav-test@example.com";
const PASSWORD = "TmpNavTest123!";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto("http://localhost:3000/login");
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45000 });
  } catch {
    console.log("Still on /login after 45s wait.");
  }

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
      console.log("Still on select-financial-year after continue.");
    }
  }

  await page.goto("http://localhost:3000/products");
  await page.waitForTimeout(3000);
  console.log("URL:", page.url());

  // Deliberately blur focus to <body> to simulate "focus lost" state.
  await page.evaluate(() => {
    (document.activeElement)?.blur();
    document.body.focus();
  });
  const activeBefore = await page.evaluate(() => document.activeElement?.tagName);
  console.log("Active element before arrow press:", activeBefore);

  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);

  const activeAfter = await page.evaluate(() => {
    const el = document.activeElement;
    return el
      ? { tag: el.tagName, text: el.textContent?.slice(0, 40), hasKbdItem: el.hasAttribute("data-kbd-item") }
      : null;
  });
  console.log("Active element after ArrowRight:", JSON.stringify(activeAfter));

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
