// Captures the viewport screenshots used on the skill's page: key moments of the demo, not full pages.
// Needs the demo running. Run: node scripts/capture-previews.mjs --url http://localhost:3200 --out <dir>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const get = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
};
const url = get("--url", "http://localhost:3200");
const out = path.resolve(get("--out", "previews"));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const shot = async (name) =>
  page.screenshot({ path: path.join(out, `${name}.jpg`), type: "jpeg", quality: 82 });
const scrollTo = async (y) => {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.waitForTimeout(1500);
};

await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(3200);
await shot("01-hero");

await page.mouse.move(700, 450);
await scrollTo(1100);
await shot("02-statement-and-numbers");

const gallery = await page.evaluate(() => {
  const el = document.querySelector("[style*='height']");
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, height: r.height };
});
await scrollTo(gallery.top + 20);
await shot("03-work-gallery-start");
await scrollTo(gallery.top + gallery.height * 0.55);
await shot("04-work-gallery-scrolling");

const services = await page.evaluate(
  () => document.querySelector("ol").getBoundingClientRect().top + window.scrollY,
);
await scrollTo(services - 150);
const row = await page.locator("ol li").nth(1).boundingBox();
await page.mouse.move(row.x + 500, row.y + row.height / 2);
await page.mouse.move(row.x + 520, row.y + row.height / 2 + 4);
await page.waitForTimeout(700);
await shot("05-services-hover");

await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(1800);
await shot("06-contact-and-footer");

await page.goto(`${url}/work/harbour-bank`, { waitUntil: "load" });
await page.waitForTimeout(2800);
await shot("07-case-study");

await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Menu" }).click();
await page.mouse.move(900, 600);
await page.waitForTimeout(1600);
await shot("08-menu-overlay");
await ctx.close();

const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  deviceScaleFactor: 2,
});
const p2 = await phone.newPage();
await p2.goto(url, { waitUntil: "load" });
await p2.waitForTimeout(3200);
await p2.screenshot({ path: path.join(out, "09-phone-hero.jpg"), type: "jpeg", quality: 82 });
await browser.close();
console.log(`wrote 9 screenshots to ${out}`);
