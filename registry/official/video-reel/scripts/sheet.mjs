// usage: node sheet.mjs <stills-folder> [out.jpg] [columns]
// One contact sheet of every t<seconds>.jpg/.png in the folder, in time order, so all the stills can
// be looked at in one image; the times are printed row by row (this ffmpeg has no drawtext). Writes <stills-folder>/sheet.jpg
// by default. Open the questionable stills at full size afterwards: dots and thin lines vanish here.
// The Instagram UI zones are shaded red (above y 250 and below y 1500 of 1080x1920): text must stay out of them.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = process.argv[2];
if (!dir) { console.error('usage: node sheet.mjs <stills-folder> [out.jpg] [columns]'); process.exit(1); }
const out = process.argv[3] || join(dir, 'sheet.jpg');
const files = readdirSync(dir)
  .map(f => [f, /^t([\d.]+)\.(jpg|png)$/.exec(f)]).filter(([, m]) => m)
  .sort((a, b) => a[1][1] - b[1][1]).map(([f, m]) => [f, m[1]]);
if (!files.length) { console.error('no t<seconds>.jpg or .png stills in ' + dir); process.exit(1); }
const n = files.length, cols = +process.argv[4] || Math.min(6, n), W = 300, H = 533;
const args = ['-loglevel', 'error', '-y'];
files.forEach(([f]) => args.push('-i', join(dir, f)));
const zone = `drawbox=x=0:y=0:w=iw:h=${Math.round(H * 250 / 1920)}:color=red@0.22:t=fill,drawbox=x=0:y=${Math.round(H * 1500 / 1920)}:w=iw:h=ih:color=red@0.22:t=fill`;
let g = files.map((_, i) => `[${i}]scale=${W}:${H},${zone}[s${i}];`).join('');
if (n === 1) g += '[s0]null';
else g += files.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${n}:fill=black:layout=` +
  files.map((_, i) => `${(i % cols) * W}_${Math.floor(i / cols) * H}`).join('|');
args.push('-filter_complex', g, '-frames:v', '1', out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
console.log(`sheet: ${out} (${n} stills, ${cols} across)`);
for (let r = 0; r * cols < n; r++) console.log(`row ${r + 1}: ` + files.slice(r * cols, r * cols + cols).map(([, t]) => t + 's').join('  '));
