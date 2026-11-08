// usage: node source.mjs https://sunnah.com/bukhari:6464   (or a quran.com URL)
// Prints the page text. Opens a real Chrome window placed off screen: sunnah.com blocks headless browsers (even --headless=new, tested 2026-10-26).
import { createRequire } from 'module'; import { execSync } from 'child_process'; import { join } from 'path';
const { chromium } = createRequire(import.meta.url)(join(execSync('npm root -g').toString().trim(), 'playwright'));
const b = await chromium.launch({ ...(process.env.REEL_CHROME ? { executablePath: process.env.REEL_CHROME } : { channel: 'chrome' }), chromiumSandbox: true, headless: false, args: ['--window-position=-32000,-32000', '--window-size=800,600'] }); const p = await b.newPage();
await p.goto(process.argv[2], { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(9000);
const t = await p.evaluate(() => { const c = document.querySelector('.actualHadithContainer') || document.body; return c.innerText; });
console.log(t.slice(0, 3000)); await b.close();
