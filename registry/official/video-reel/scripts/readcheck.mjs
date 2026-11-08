// usage: node readcheck.mjs <reel-folder> [--step 0.0333]
// Reading-time check: every piece of on-screen text stays long enough to read, by our pace rule
// (rules.md, Pace: 0.2 s a word plus 0.7 s once it lands). It checks the shortest hold only, never a longest one,
// so a long reading pause always passes.
// Page contract (optional, add it to index.html): window.TEXTS(t) -> [{id, text, x0, y0, x1, y1}], every text block
//   that is READABLE at t (fully landed, opacity about .8 or more) with its screen box in page pixels (1080x1920).
//   id names the block; new text under the same id counts as a new piece. Report a typed or pen-written line with its
//   full text from the frame it is complete, never the part written so far.
// Each piece: its first continuous readable stretch must be >= 0.2 s x words + 0.7 s (at least 1.0 s).
// A box outside the frame fails. A box outside y 250 to 1500 (the Instagram buttons) is a WARN.
// Exit: 0 all pass, 1 some fail, 2 not checked (no window.TEXTS, or it never returned text). 2 is not a pass.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { join, resolve } from 'path';

const args = process.argv.slice(2);
if (!args[0]) { console.error('usage: node readcheck.mjs <reel-folder> [--step 0.0333]'); process.exit(2); }
const dir = resolve(args[0]);
const si = args.indexOf('--step'), STEP = si >= 0 ? Number(args[si + 1]) : 1 / 30;
if (!(STEP > 0)) { console.error('--step must be > 0'); process.exit(2); }
const W = 1080, H = 1920, SAFE0 = 250, SAFE1 = 1500, PER_WORD = 0.2, PAD = 0.7, MIN = 1.0;
const root = process.env.NODE_GLOBAL || execSync('npm root -g').toString().trim();
const { chromium } = createRequire(import.meta.url)(join(root, 'playwright'));

const browser = await chromium.launch({ ...(process.env.REEL_CHROME ? { executablePath: process.env.REEL_CHROME } : { channel: 'chrome' }), chromiumSandbox: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
await page.goto('file://' + join(dir, 'index.html'));
await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
const res = await page.evaluate(({ STEP, W, H }) => {
  if (typeof window.TEXTS !== 'function') return { noTexts: true };
  const DUR = window.DURATION;
  if (!(DUR > 0)) return { noDur: true };
  const seen = {}, outside = {};
  for (let i = 0; i * STEP <= DUR; i++) {
    const t = i * STEP;
    window.frame(t);
    const vis = new Set();
    for (const b of window.TEXTS(t) || []) {
      const key = String(b.id) + '\u0000' + b.text;
      if (!(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= W && b.y1 <= H)) { outside[key] ??= { id: String(b.id), text: b.text, t0: t }; continue; }
      vis.add(key);
      const s = seen[key] ??= { id: String(b.id), text: b.text, t0: t, run: 0, done: false, y0: b.y0, y1: b.y1 };
      if (!s.done) s.run = Math.min(t + STEP, DUR) - s.t0;
      s.y0 = Math.min(s.y0, b.y0); s.y1 = Math.max(s.y1, b.y1);
    }
    for (const k in seen) if (!vis.has(k)) seen[k].done = true;   // only the first readable stretch counts
  }
  for (const k in outside) if (seen[k]) delete outside[k];
  return { seen: Object.values(seen), outside: Object.values(outside) };
}, { STEP, W, H });
await browser.close();

if (res.noTexts || res.noDur || (!res.seen.length && !res.outside.length)) {
  console.error('readcheck: NOT CHECKED. ' + (res.noTexts ? 'index.html has no window.TEXTS(t); see the top of this script for the contract.'
    : res.noDur ? 'window.DURATION is not a positive number.' : 'window.TEXTS(t) never returned any text.') + ' This is not a pass.');
  process.exit(2);
}
const words = s => s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const need = s => Math.max(MIN, PER_WORD * words(s) + PAD);
let bad = 0, warn = 0;
for (const s of res.seen.sort((a, b) => a.t0 - b.t0)) {
  const n = need(s.text), ok = s.run >= n - 1e-6, unsafe = s.y0 < SAFE0 || s.y1 > SAFE1;
  if (!ok) bad++; if (unsafe) warn++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${s.id.padEnd(14)} at ${s.t0.toFixed(2)}s  ${String(words(s.text)).padStart(2)} words  need ${n.toFixed(2)}s  got ${s.run.toFixed(2)}s${unsafe ? '  WARN outside y 250-1500' : ''}  ${JSON.stringify(s.text.slice(0, 40))}`);
}
for (const s of res.outside) { bad++; console.log(`FAIL ${s.id.padEnd(14)} at ${s.t0.toFixed(2)}s  never fully in the frame  ${JSON.stringify(s.text.slice(0, 40))}`); }
console.log(`readcheck: ${res.seen.length} texts, ${bad} fail, ${warn} warn`);
process.exit(bad ? 1 : process.exitCode || 0);
