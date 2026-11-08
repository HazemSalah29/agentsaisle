// usage: node capture.mjs <reel-folder> stills 1,3.5,8   |   node capture.mjs <reel-folder> frames [out-dir]
//        node capture.mjs <reel-folder> sub <list.json> <out-dir>   (motion-blur subframes, from blur.py detect)
//        node capture.mjs <reel-folder> verify                      (flicker test: 12 times drawn twice must match)
//        node capture.mjs <reel-folder> clip 4.2-7.5,12-13.4        (motion review: clips/<range>.mp4, no sound, plus clips/<range>.jpg, every 2nd frame tiled)
//        node capture.mjs <reel-folder> scope index.before.html 4.2-7.5,12-13.4 [step]
//                                                                   (after a fix: frames outside the ranges must match the copy saved before it, pixel for pixel;
//                                                                    every 3rd frame by default; references/review.md, The scope check)
// Loads <reel-folder>/index.html in system Chrome at 1080x1920 and calls window.frame(t) per image.
// frames: writes sfx.json to the reel folder and the JPEGs to out-dir (default <reel-folder>/frames).
// frame(t) is a pure function of t, so REEL_TABS tabs (default 4; more gave no gain on a 10-core Mac, 2026-10-23) each draw every Nth frame at once.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const [dirArg, mode, arg] = process.argv.slice(2);
if (!dirArg || !['stills', 'frames', 'sub', 'verify', 'clip', 'scope'].includes(mode)) { console.error('usage: node capture.mjs <reel-folder> stills <t1,t2> | frames [out-dir] | clip <t0-t1,...> | scope <before.html> <t0-t1,...> [step]'); process.exit(1); }
const dir = resolve(dirArg);
const root = process.env.NODE_GLOBAL || execSync('npm root -g').toString().trim();
const { chromium } = createRequire(import.meta.url)(join(root, 'playwright'));
const FPS = 30;

// file access lets pages load ES modules from file:// (the ember kit and three.js need it)
const browser = await chromium.launch({ ...(process.env.REEL_CHROME ? { executablePath: process.env.REEL_CHROME } : { channel: 'chrome' }), chromiumSandbox: true, args: ['--allow-file-access-from-files'] });
const open = async (file = 'index.html') => {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.goto('file://' + resolve(dir, file));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  return page;
};
const shot = async (page, t, file) => { await page.evaluate(t => window.frame(t), t); await page.screenshot({ path: file, type: 'jpeg', quality: 92 }); };
const tabsN = () => Math.max(1, Number(process.env.REEL_TABS) || 4);

if (mode === 'stills') {
  const page = await open();
  mkdirSync(join(dir, 'stills'), { recursive: true });
  for (const t of arg.split(',').map(Number)) await shot(page, t, join(dir, 'stills', `t${t}.jpg`));
  console.log('stills in', join(dir, 'stills'));
} else if (mode === 'sub') {
  // each fast frame f gets K subframes spread over half a frame (180-degree shutter), centred on f
  const out = resolve(process.argv[5]);
  mkdirSync(out, { recursive: true });
  const jobs = Object.entries(JSON.parse(readFileSync(resolve(arg)))).flatMap(([f, k]) =>
    Array.from({ length: k }, (_, j) => [Math.max(0, (Number(f) + ((j + 0.5) / k - 0.5) * 0.5) / FPS), join(out, `${String(f).padStart(5, '0')}_${j}.jpg`)]));
  const pages = await Promise.all(Array.from({ length: tabsN() }, open));
  await Promise.all(pages.map(async (page, k) => { for (let i = k; i < jobs.length; i += pages.length) await shot(page, ...jobs[i]); }));
  console.log(jobs.length, 'subframes');
} else if (mode === 'clip') {
  // each range: frames to a temp folder, then one silent mp4 and a strip of every 2nd frame, 8 a row
  const ranges = arg.split(',').map(r => r.split('-').map(Number));
  if (ranges.some(([a, b]) => !(b > a))) { console.error('clip ranges look like 4.2-7.5'); process.exit(1); }
  mkdirSync(join(dir, 'clips'), { recursive: true });
  const pages = await Promise.all(Array.from({ length: tabsN() }, open));
  for (const [a, b] of ranges) {
    const tmp = execSync('mktemp -d').toString().trim(), name = join(dir, 'clips', `${a}-${b}`);
    const f0 = Math.round(a * FPS), n = Math.round(b * FPS) - f0;
    await Promise.all(pages.map(async (page, k) => { for (let i = k; i < n; i += pages.length) await shot(page, (f0 + i) / FPS, join(tmp, String(i).padStart(5, '0') + '.jpg')); }));
    execSync(`ffmpeg -loglevel error -y -framerate ${FPS} -i "${tmp}/%05d.jpg" -c:v libx264 -crf 20 -pix_fmt yuv420p "${name}.mp4"`);
    execSync(`ffmpeg -loglevel error -y -framerate ${FPS} -i "${tmp}/%05d.jpg" -vf "select='not(mod(n\\,2))',scale=216:-1,tile=8x${Math.ceil(n / 16)}" -frames:v 1 "${name}.jpg"`);
    execSync(`rm -rf "${tmp}"`);
    console.log('clip', `${name}.mp4`, n, 'frames');
  }
} else if (mode === 'scope') {
  // each tab holds the before page and the after page; both draw the same t and the PNG bytes must match outside the ranges
  const ranges = (process.argv[5] || '').split(',').filter(Boolean).map(r => r.split('-').map(Number));
  if (!arg || !ranges.length || ranges.some(([a, b]) => !(b > a))) { console.error('usage: node capture.mjs <reel-folder> scope <before.html> <t0-t1,...> [step]'); process.exit(1); }
  const step = Math.max(1, Math.round(Number(process.argv[6]) || 3));
  const pairs = await Promise.all(Array.from({ length: tabsN() }, async () => [await open(arg), await open()]));
  const durs = await Promise.all(pairs[0].map(p => p.evaluate(() => window.DURATION)));
  if (durs[0] !== durs[1]) console.log(`WARN: length changed from ${durs[0]} s to ${durs[1]} s, so every later frame may move`);
  const n = Math.round(Math.min(...durs) * FPS), inScope = t => ranges.some(([a, b]) => t >= a && t <= b);
  const ts = []; for (let f = 0; f < n; f += step) ts.push(f / FPS);
  const grab = async (page, t) => { await page.evaluate(t => window.frame(t), t); return page.screenshot({ type: 'png' }); };
  const outside = [], inside = [];
  let first = null;
  await Promise.all(pairs.map(async ([before, after], k) => {
    for (let i = k; i < ts.length; i += pairs.length) {
      const t = ts[i], a = await grab(before, t), b = await grab(after, t);
      if (a.equals(b)) continue;
      if (inScope(t)) { inside.push(t); continue; }
      outside.push(t);
      if (!first || t < first.t) first = { t, a, b };
    }
  }));
  // join changed times into spans, so one long change prints as one line
  const spans = outside.sort((x, y) => x - y).reduce((s, t) => {
    const last = s[s.length - 1];
    if (last && t - last[1] <= step * 1.5 / FPS) last[1] = t; else s.push([t, t]);
    return s;
  }, []);
  console.log(`scope: ${ts.length} frames compared (every ${step}), ${inside.length} changed inside ${ranges.map(r => r.join('-')).join(', ')}`);
  if (!inside.length) console.log('  WARN nothing changed inside the scope: the fix did nothing there');
  if (spans.length) {
    mkdirSync(join(dir, 'scope'), { recursive: true });
    const tag = first.t.toFixed(2);
    writeFileSync(join(dir, 'scope', `t${tag}-before.png`), first.a);
    writeFileSync(join(dir, 'scope', `t${tag}-after.png`), first.b);
    console.log(`FAIL: ${outside.length} frames changed outside the scope:`);
    for (const [a, b] of spans) console.log(`  ${a.toFixed(2)} to ${b.toFixed(2)} s`);
    console.log(`  first one saved as ${join(dir, 'scope', `t${tag}-before.png`)} and -after.png`);
    process.exitCode = 1;
  } else console.log('PASS: every frame outside the scope is identical');
} else if (mode === 'verify') {
  // draw 12 times in order, then again in reverse (so each comes after a jump elsewhere); every pair must match
  const page = await open();
  const dur = await page.evaluate(() => window.DURATION);
  const ts = Array.from({ length: 12 }, (_, i) => Math.round((0.37 + i * (dur - 0.74) / 11) * FPS) / FPS);
  const grab = async t => { await page.evaluate(t => window.frame(t), t); return (await page.screenshot({ type: 'png' })).toString('base64'); };
  const a = []; for (const t of ts) a.push(await grab(t));
  const bad = []; for (let i = ts.length - 1; i >= 0; i--) if ((await grab(ts[i])) !== a[i]) bad.push(ts[i]);
  console.log(bad.length ? `FAIL: frames differ when drawn twice at ${bad.reverse().join(', ')} s (look for Math.random, Date.now, timers or state kept between frames)` : `PASS: all ${ts.length} frames identical when drawn twice`);
  if (bad.length) process.exitCode = 1;
} else {
  const out = resolve(arg || join(dir, 'frames'));
  mkdirSync(out, { recursive: true });
  const tabs = tabsN();
  const pages = await Promise.all(Array.from({ length: tabs }, open));
  const dur = await pages[0].evaluate(() => window.DURATION);
  writeFileSync(join(dir, 'sfx.json'), JSON.stringify({ duration: dur, events: await pages[0].evaluate(() => window.SFX) }));
  const n = Math.round(dur * FPS);
  await Promise.all(pages.map(async (page, k) => {
    for (let f = k; f < n; f += tabs) await shot(page, f / FPS, join(out, String(f).padStart(5, '0') + '.jpg'));
  }));
  console.log(n, 'frames,', dur, 's,', tabs, 'tabs');
}
await browser.close();
