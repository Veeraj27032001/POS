import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(6000);
const info = await page.evaluate(() => ({
  htmlFont: getComputedStyle(document.documentElement).fontFamily,
  bodyFont: getComputedStyle(document.body).fontFamily,
  varOnHtml: getComputedStyle(document.documentElement).getPropertyValue("--font-sans"),
  varOnBody: getComputedStyle(document.body).getPropertyValue("--font-sans"),
  h1: (() => { const h = document.querySelector("h1,h2,p"); return h ? getComputedStyle(h).fontFamily : "none"; })(),
}));
console.log(JSON.stringify(info, null, 1));
await browser.close();
