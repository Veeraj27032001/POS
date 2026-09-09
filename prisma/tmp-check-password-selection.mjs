import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`
    <input id="text" type="text" value="hello" />
    <input id="pw" type="password" value="hello123" />
    <input id="email" type="email" value="a@b.com" />
    <input id="tel" type="tel" value="1234567890" />
    <input id="url" type="url" value="http://a.com" />
    <input id="search" type="search" value="hello" />
    <input id="number" type="number" value="123" />
    <input id="date" type="date" value="2026-01-01" />
  `);
  const result = await page.evaluate(() => {
    const out = {};
    for (const id of ["text", "pw", "email", "tel", "url", "search", "number", "date"]) {
      const el = document.getElementById(id);
      try {
        out[id] = { selectionStart: el.selectionStart, selectionEnd: el.selectionEnd };
      } catch (e) {
        out[id] = { threw: true, message: e.message };
      }
    }
    return out;
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
main();
