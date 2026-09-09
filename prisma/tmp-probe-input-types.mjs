import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`
    <input id="num" type="number" value="42" />
    <input id="date" type="date" value="2026-09-09" />
    <input id="txt" type="text" value="hello" />
  `);

  for (const id of ["num", "date", "txt"]) {
    const result = await page.evaluate((elId) => {
      const el = document.getElementById(elId);
      el.focus();
      const out = { id: elId };
      try {
        out.selectionStart = el.selectionStart;
        out.selectionEnd = el.selectionEnd;
      } catch (e) {
        out.threw = e.message;
      }
      return out;
    }, id);
    console.log(JSON.stringify(result));
  }

  // Now check what happens after pressing End / ArrowRight on the date field specifically.
  await page.locator("#date").click();
  await page.keyboard.press("Home");
  const afterHome = await page.evaluate(() => {
    const el = document.getElementById("date");
    const out = {};
    try {
      out.selectionStart = el.selectionStart;
      out.selectionEnd = el.selectionEnd;
    } catch (e) {
      out.threw = e.message;
    }
    return out;
  });
  console.log("date after Home:", JSON.stringify(afterHome));

  await page.keyboard.press("End");
  const afterEnd = await page.evaluate(() => {
    const el = document.getElementById("date");
    const out = {};
    try {
      out.selectionStart = el.selectionStart;
      out.selectionEnd = el.selectionEnd;
    } catch (e) {
      out.threw = e.message;
    }
    return out;
  });
  console.log("date after End:", JSON.stringify(afterEnd));

  await browser.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
