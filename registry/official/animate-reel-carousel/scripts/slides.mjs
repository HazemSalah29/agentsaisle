// usage: node slides.mjs <deck-folder> <out-dir>
// Captures each <deck-folder>/slides/NN.html to <out-dir>/NN.png at the deck size (3:4, 4:5 or 1:1).
// Exits 1 and names the slide if a page reports window.overflow === true (text does not fit); that slide gets no PNG.
// Old NN.png files numbered above the slide count are deleted first, so no stale slide ships.
// Playwright comes from NODE_GLOBAL (else npm root -g); Chrome from REEL_CHROME (else system Chrome).
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

const [dirArg, outArg] = process.argv.slice(2);
if (!dirArg || !outArg) { console.error('usage: node slides.mjs <deck-folder> <out-dir>'); process.exit(1); }
const dir = resolve(dirArg), out = resolve(outArg);
const SIZES = { '3:4': [1080, 1440], '4:5': [1080, 1350], '1:1': [1080, 1080] };
let deck;
try { deck = JSON.parse(readFileSync(join(dir, 'deck.json'), 'utf8')); }
catch (e) { console.error(`cannot read deck.json in ${dir}: ${e.message}`); process.exit(1); }
const size = SIZES[deck.size || '3:4'];
if (!size) { console.error(`unknown size ${deck.size}`); process.exit(1); }
let files = [];
try { files = readdirSync(join(dir, 'slides')).filter(f => /^\d+\.html$/.test(f)).sort(); } catch (e) {}
if (!files.length) { console.error('no slides/NN.html found'); process.exit(1); }
const want = (deck.slides || []).length;
if (files.length !== want) { console.error(`deck.json lists ${want} slides but slides/ has ${files.length} pages; rerun make-slides.py or remove stale pages`); process.exit(1); }
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (/^\d+\.png$/.test(f) && parseInt(f, 10) > want) rmSync(join(out, f));

const root = process.env.NODE_GLOBAL || execSync('npm root -g').toString().trim();
const { chromium } = createRequire(import.meta.url)(join(root, 'playwright'));
const browser = await chromium.launch(process.env.REEL_CHROME ? { executablePath: process.env.REEL_CHROME } : { channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
for (const f of files) {
  const n = f.replace('.html', '');
  await page.goto(pathToFileURL(join(dir, 'slides', f)).href);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  if (await page.evaluate(() => window.overflow)) {
    rmSync(join(out, `${n}.png`), { force: true });
    console.error(`text overflows slide ${n}`); process.exitCode = 1; continue;
  }
  await page.screenshot({ path: join(out, `${n}.png`), type: 'png' });
}
await browser.close();
console.log(files.length, 'slides in', out);
