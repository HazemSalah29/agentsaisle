// lint-skills: allow-network (the preview page only talks to this script's own localhost server)
// usage: node preview.mjs <reel-folder> [port]
// Plays the reel live in a browser, with its sound, before any render. Open http://localhost:<port>/
// The page is the same index.html the render uses: the player calls window.frame(t) on every
// animation frame, with the audio as the clock. On load (and on every save of a file in the
// folder) the player sends the page's SFX to this server, which writes sfx.json and runs mix.py
// into a temp folder, then the player reloads the sound. No frames, no encode.
import http from 'http';
import { execFile } from 'child_process';
import { readFileSync, writeFileSync, existsSync, statSync, watch, mkdtempSync } from 'fs';
import { join, resolve, extname, sep } from 'path';
import { tmpdir } from 'os';

const dir = resolve(process.argv[2] || '');
const port = Number(process.argv[3]) || 4170;
if (!existsSync(join(dir, 'index.html'))) { console.error('usage: node preview.mjs <reel-folder> [port]'); process.exit(1); }
const mixer = join(import.meta.dirname, 'mix.py');
const tmp = mkdtempSync(join(tmpdir(), 'reel-preview-'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };
const clients = new Set();
let mixing = Promise.resolve(), version = 0;

const PLAYER = `<!doctype html><meta charset="utf-8"><title>Reel preview</title>
<style>
:root{--bg:#141414;--panel:#1f1f1f;--ink:#eee;--quiet:#9a9a9a;--accent:#d9a441}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 system-ui,sans-serif;height:100vh;display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px}
#stage{flex:1;min-height:0;aspect-ratio:9/16;position:relative;overflow:hidden;background:#000;border-radius:6px}
iframe{position:absolute;left:0;top:0;width:1080px;height:1920px;border:0;transform-origin:0 0}
#bar{width:min(100%,640px);display:flex;align-items:center;gap:10px;background:var(--panel);padding:8px 12px;border-radius:8px}
button{background:var(--ink);color:var(--bg);border:0;border-radius:6px;padding:6px 12px;font:600 14px system-ui;cursor:pointer;min-width:64px}
input[type=range]{flex:1;accent-color:var(--accent)}
#time,#info{font:12px ui-monospace,monospace;color:var(--quiet);white-space:nowrap}
</style>
<div id="stage"><iframe id="f" src="/index.html"></iframe></div>
<div id="bar"><button id="play">Play</button><input id="seek" type="range" min="0" step="0.001" value="0"><span id="time">0.00 s</span>
<label id="info"><input id="loop" type="checkbox" checked> loop</label><span id="info2" style="font:12px ui-monospace;color:var(--quiet)"></span></div>
<script>
const f=document.getElementById('f'),stage=document.getElementById('stage'),seek=document.getElementById('seek'),
 time=document.getElementById('time'),play=document.getElementById('play'),info=document.getElementById('info2'),loop=document.getElementById('loop');
const audio=new Audio();let dur=10,t=0,playing=false,start=0,frames=0,fpsAt=performance.now(),ready=false,gen=0;
// Play waits for the sound: a long reel takes minutes to mix, and a silent play looked like a bug
const setReady=on=>{ready=on;play.disabled=!on;play.textContent=on?(playing?'Pause':'Play'):'making sound...'};
const fit=()=>{f.style.transform='scale('+stage.clientWidth/1080+')'};new ResizeObserver(fit).observe(stage);
const draw=x=>{t=Math.max(0,Math.min(dur,x));try{f.contentWindow.frame(t)}catch(e){}seek.value=t;time.textContent=t.toFixed(2)+' s / '+dur.toFixed(1)+' s'};
const now=()=>audio.src&&!audio.error&&audio.readyState>1?audio.currentTime:(performance.now()-start)/1000;
function setPlay(on){if(on&&!ready)return;playing=on;play.textContent=on?'Pause':'Play';
 if(on){if(t>=dur-0.01)t=0;start=performance.now()-t*1000;audio.currentTime=t;audio.play().catch(()=>{})}else audio.pause()}
function tick(){if(playing){let x=now();if(x>=dur){if(loop.checked){x=0;audio.currentTime=0;start=performance.now();audio.play().catch(()=>{})}else{x=dur;setPlay(false)}}draw(x);frames++}
 const n=performance.now();if(n-fpsAt>1000){info.textContent=playing?Math.round(frames*1000/(n-fpsAt))+' fps':'';frames=0;fpsAt=n}requestAnimationFrame(tick)}
async function loaded(){const w=f.contentWindow;for(let i=0;i<300&&!w.ready;i++)await new Promise(r=>setTimeout(r,50));
 dur=w.DURATION||10;seek.max=dur;draw(t);const my=++gen;if(playing)setPlay(false);setReady(false);
 const r=await fetch('/__sfx',{method:'POST',body:JSON.stringify({duration:dur,events:w.SFX||[]})});const v=await r.text();if(my!==gen)return;
 if(!r.ok){info.textContent='sound failed, see terminal';return setReady(true)}
 audio.src='/__audio.wav?v='+v;audio.addEventListener('loadeddata',()=>{if(my!==gen)return;audio.currentTime=t;setReady(true)},{once:true})}
f.addEventListener('load',loaded);
play.onclick=()=>setPlay(!playing);
seek.oninput=()=>{draw(+seek.value);audio.currentTime=t;start=performance.now()-t*1000};
addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();setPlay(!playing)}if(e.code==='ArrowRight'||e.code==='ArrowLeft'){draw(t+(e.code==='ArrowRight'?1:-1)/30);audio.currentTime=t;start=performance.now()-t*1000}});
new EventSource('/__events').onmessage=()=>{f.src='/index.html?'+Date.now()};
requestAnimationFrame(tick);
</script>`;

// Saves while a mix runs collapse into one next mix of the latest SFX, so a burst of saves
// waits for two mixes, not one per save.
let latest = '', queued = null;
function mix(body) {
  latest = body;
  if (!queued) mixing = queued = mixing.then(() => { queued = null; writeFileSync(join(dir, 'sfx.json'), latest);
    return new Promise(done => execFile('python3', [mixer, dir, tmp], (err, out, errOut) => {
      if (err) console.error('mix failed:', errOut || err.message); else version++;
      done();
    })); });
  return queued;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/') return res.end(PLAYER);
  if (url.pathname === '/__events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (url.pathname === '/__sfx' && req.method === 'POST') {
    let body = ''; for await (const c of req) body += c;
    await mix(body);
    return res.end(String(version));
  }
  if (url.pathname === '/__audio.wav') {
    const p = join(tmp, 'audio.wav');
    if (!existsSync(p)) { res.statusCode = 404; return res.end(); }
    // Chrome can only seek audio when the server answers Range requests; without them a paused
    // reel restarted from 0 on Play (the clock follows audio.currentTime).
    const buf = readFileSync(p), m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    const head = { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    if (!m) { res.writeHead(200, { ...head, 'Content-Length': buf.length }); return res.end(buf); }
    const a = m[1] ? +m[1] : Math.max(0, buf.length - +m[2]), b = m[1] && m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${a}-${b}/${buf.length}`, 'Content-Length': b - a + 1 });
    return res.end(buf.subarray(a, b + 1));
  }
  const p = resolve(join(dir, decodeURIComponent(url.pathname)));
  if (!(p === dir || p.startsWith(dir + sep)) || !existsSync(p) || statSync(p).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(p));
}).listen(port, '127.0.0.1', () => console.log(`preview: http://localhost:${port}/  (${dir})`));

// reload the player when a source file in the folder is saved (not sfx.json, which the server writes)
let timer;
watch(dir, (ev, name) => {
  if (!name || name === 'sfx.json' || /\.(mp4|wav|jpg)$/.test(name) || name.startsWith('stills')) return;
  clearTimeout(timer); timer = setTimeout(() => clients.forEach(c => c.write('data: reload\n\n')), 200);
});
