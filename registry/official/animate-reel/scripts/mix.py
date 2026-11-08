# usage: python3 mix.py <reel-folder> [out-dir]
# Reads <reel-folder>/sfx.json (written by capture.mjs) and writes audio.wav to out-dir (default <reel-folder>):
# one sample per event (top end kept), over a calm bed (bed.txt; never a hum), at one fixed level for every reel (no loudness target).
# `boom` and `rise` are made in code, not read from a file (references/sound.md).
import json, os, subprocess, sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
SKILLS = os.path.normpath(os.path.join(HERE, '..', '..'))  # the folder that holds this skill's sibling skills
# The kit's own sounds live in the animate-reel-sounds pack, the SFX Kit wavs in animate-reel-sfx-1..4 (each CC0 pack
# is a separate skill that animate-reel requires). Both are looked up next to this skill; a copy inside it also works.
LIB = next((d for d in (os.path.join(HERE, '..', 'assets', 'sfx'), os.path.join(SKILLS, 'animate-reel-sounds', 'assets', 'sfx'))
            if os.path.isdir(d)), os.path.join(SKILLS, 'animate-reel-sounds', 'assets', 'sfx'))


def kit_file(rel):
    """Absolute path of an SFX Kit wav (rel is the 'file' of sounds.json), searched in the four packs."""
    for n in (1, 2, 3, 4):
        p = os.path.join(SKILLS, f'animate-reel-sfx-{n}', 'assets', 'sfx-kit', rel)
        if os.path.isfile(p): return p
    own = os.path.join(HERE, '..', 'assets', 'sfx-kit', rel)
    if os.path.isfile(own): return own
    sys.exit(f'SFX Kit sound {rel!r} not found; install the packs: aisle add animate-reel-sfx-1 .. animate-reel-sfx-4')
SOUND = {  # type -> (sample file, or list rotated per event; default gain)
    'key': ([f'keypress-00{i}.wav' for i in range(1, 7)], .2),
    'tick': ([f'chips-collide-{i}.ogg' for i in range(1, 5)], .35),
    'drop': ('drop_001.ogg', .3), 'plink': ('drop_002.ogg', .4),
    'tap': ('impactSoft_medium_001.ogg', .4), 'thud': ('impactSoft_heavy_002.ogg', .5),
    'bell': ('impactBell_heavy_000.ogg', .3), 'bell2': ('impactBell_heavy_003.ogg', .3),
    'bong': ('bong_001.ogg', .45), 'slide': ('card-slide-1.ogg', .3),
    'glass': ([f'impactGlass_light_00{i}.ogg' for i in range(5)], .3), 'wood': ([f'impactWood_light_00{i}.ogg' for i in range(5)], .25),
    'thunder': ([f'thunder-{i}.m4a' for i in range(1, 7)], .5),  # SFXMint CC0 rumbles, 4-6 s; intense reels only
}

# SFX Kit (assets/sfx-kit, CC0): an event type 'kit:<id>' plays sounds/<category>/<id>.wav, started
# sync.at seconds early so its sync point (the hit, the arrival, the move's peak) lands on the event time.
KIT = {s['id']: s for s in json.load(open(os.path.join(HERE, '..', 'assets', 'sfx-kit', 'sounds.json')))['sounds']}
KIT_GAIN = 1.0  # the files as they are: level with the glass and plink defaults (measured 2026-10-24)
# Sounds that carry a melody (chords, runs, rising note steps). Blocked until the user allows them.
KIT_BLOCK = {i for i in KIT if i.startswith('sting-') or i.startswith('tone-step-')}

SYNTH = {'boom': .9, 'rise': .25, 'crack': .7}  # type -> default gain
ECHO = .2   # soft room echo on the effects (wet level); 0 turns it off
PAN = .3    # gentle left/right drift for effects with no 'pan' of their own (-1 left .. 1 right)

folder = sys.argv[1]
dest = sys.argv[2] if len(sys.argv) > 2 else folder
data = json.load(open(os.path.join(folder, 'sfx.json')))
DUR, events = data['duration'], data['events']
cache = {}
def load(f):
    if f not in cache:
        raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', os.path.join(LIB, f), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                             capture_output=True, check=True).stdout
        cache[f] = np.frombuffer(raw, np.float32).astype(np.float64)
    return cache[f]

out = np.zeros((2, int(SR * (DUR + 3))))  # stereo
N = out.shape[1]
BOOST_DB = 20  # the fixed level for every reel; see the loudness note at the end
# No single sound may set the level of the whole reel (the wing reel, 2026-10-24: one peaky 'drop' at
# v .8 would have peaked 17.5 dB over the ceiling, so the old whole-mix turn-down made every other sound
# and the bed 18 dB quieter, and the reel felt "very very quiet"). Each sound is capped on its own at
# -3 dB after the boost, so the turn-down at the end only acts on rare overlaps.
SOUND_PEAK = .7 / 10 ** (BOOST_DB / 20)
def put(x, i, e):  # add sound x at sample i, panned by e['pan'] or a gentle drift (constant power)
    pk = np.abs(x).max() if x.size else 0
    if pk > SOUND_PEAK: x = x * (SOUND_PEAK / pk)
    p = e.get('pan')
    if p is None: p = 0 if e['type'] in SYNTH else PAN * np.sin(e['t'] * 2.3 + len(e['type']))
    a = max(0, i); x = x[a - i:max(0, min(x.size, N - i))]
    out[0, a:a + x.size] += x * np.cos((p + 1) * np.pi / 4)
    out[1, a:a + x.size] += x * np.sin((p + 1) * np.pi / 4)
soft = butter(2, 16000, 'lowpass', fs=SR, output='sos')  # hiss guard only; the strong pages keep their top end
count = {}
rng = np.random.default_rng(7)
def boom():  # a deep hit: pitch falls 54 to 36 Hz, 2 s tail, a soft click on top
    t = np.arange(int(SR * 2.4)) / SR
    body = np.sin(2 * np.pi * np.cumsum(36 + 18 * np.exp(-t * 6)) / SR) * np.exp(-t * 1.6)
    return .9 * body + .35 * sosfilt(butter(2, 1800, 'low', fs=SR, output='sos'), rng.standard_normal(t.size)) * np.exp(-t * 60)
def rise(n=int(SR * 2.4)):  # band noise sweeping 300 Hz to 4 kHz; it ENDS at the event time
    out, noise, step = np.zeros(n), rng.standard_normal(n), int(SR * .04)
    for i in range(0, n, step):
        fc = 300 * (4000 / 300) ** (i / n); j = min(n, i + step)
        out[i:j] = sosfilt(butter(2, [fc * .7, fc * 1.4], 'band', fs=SR, output='sos'), noise[max(0, i - step):j])[-(j - i):]
    return out * np.linspace(0, 1, n) ** 2.2
def crack():  # a thunder snap: a bright noise burst, then a short rumble
    t = np.arange(int(SR * 1.6)) / SR; n = rng.standard_normal(t.size)
    snap = sosfilt(butter(2, 1500, 'high', fs=SR, output='sos'), n) * np.exp(-t * 30)
    rumble = sosfilt(butter(2, [40, 300], 'band', fs=SR, output='sos'), n) * np.exp(-t * 2.5) * (1 - np.exp(-t * 20))
    return .8 * snap + 1.4 * rumble
def beat():  # a smooth soft beat: a round low thump, no click, no ring
    t = np.arange(int(SR * .9)) / SR
    return np.sin(2 * np.pi * np.cumsum(46 + 30 * np.exp(-t * 14)) / SR) * (1 - np.exp(-t * 120)) * np.exp(-t * 5)
# The full hit (rise + boom) plays ONCE, on the last boom (the ending beat). On repeat it is sharp to the
# ears, so every earlier boom becomes a soft `beat` and a `rise` plays only into the
# last boom. The rise is low-passed at 1.5 kHz so the sweep is soft.
SYNTH['beat'] = .75
booms = [e['t'] for e in events if e['type'] == 'boom']
last = max(booms) if booms else None
for e in events:
    if e['type'] == 'boom' and e['t'] != last: e['type'], e['v'] = 'beat', None
events = [e for e in events if e['type'] != 'rise' or (last is not None and abs(e['t'] - last) < .6)]
made = {}
for e in events:
    if e['type'] in SYNTH:
        x = made.setdefault(e['type'], {'boom': boom, 'rise': lambda: sosfilt(butter(2, 1500, 'low', fs=SR, output='sos'), rise()),
                                        'crack': crack, 'beat': beat}[e['type']]())
        x = x * (e.get('v') if e.get('v') is not None else SYNTH[e['type']])
        put(x, int(e['t'] * SR) - (x.size if e['type'] == 'rise' else 0), e); continue
    if e['type'].startswith('kit:'):
        k = KIT.get(e['type'][4:])
        if not k: sys.exit(f"unknown kit sound {e['type']!r}; see assets/sfx-kit/catalogue.md")
        if k['id'] in KIT_BLOCK: sys.exit(f"{e['type']!r} carries a melody; ask the user first (references/sound.md)")
        x = sosfilt(soft, load(kit_file(k['file']))) * (e.get('v') if e.get('v') is not None else KIT_GAIN)
        put(x, int((e['t'] - k['sync']['at']) * SR), e); continue
    if e['type'] not in SOUND: sys.exit(f"unknown sound type {e['type']!r}; see references/sound.md")
    f, g = SOUND[e['type']]
    if isinstance(f, list):
        k = count.get(e['type'], 0); count[e['type']] = k + 1; f = f[k % len(f)]
    x = sosfilt(soft, load(f)) * (e.get('v') if e.get('v') is not None else g)
    put(x, int(e['t'] * SR), e)

# No hum, ever.
# The bed is a calm, unpitched sound named in <reel-folder>/bed.txt as "<name> [gain] [start_s]", one of
# assets/sfx/beds/*.m4a (sea, ocean, rain, wind, breeze, desert-wind, birds, forest, jungle, crickets,
# insects, fireplace) or "air" (soft breathing noise) or "none".
# No bed.txt means "air". Beds loop to the reel length. One line per bed: with several lines the bed
# changes at each start time with a 2 s crossfade (rain in a storm, then air), so a reel whose scenes
# change needs no second mix pass.
# soft echo: a 1.8 s decaying-noise room, different for each ear so it also widens the sound
if ECHO:
    n = int(SR * 1.8); te = np.arange(n) / SR; lp = butter(1, 4500, 'low', fs=SR, output='sos')
    for c in (0, 1):
        h = sosfilt(lp, np.random.default_rng(11 + c).standard_normal(n)) * np.exp(-te * 3.4); h /= np.sqrt(np.sum(h**2))
        pre = int(SR * .025); out[c, pre:] += ECHO * fftconvolve(out[c], h)[:N - pre]

t = np.arange(N) / SR
bp = os.path.join(folder, 'bed.txt')
specs = [l.split() for l in open(bp).read().splitlines() if l.strip()] if os.path.exists(bp) else [['air']]
specs = sorted([(sp[0], float(sp[1]) if len(sp) > 1 else 1.0, float(sp[2]) if len(sp) > 2 else 0.0) for sp in specs], key=lambda sp: sp[2])
def one_bed(name):
    if name == 'air':
        return sosfilt(butter(2, [200, 1200], 'bandpass', fs=SR, output='sos'), np.random.default_rng(3).normal(0, 1, t.size)) * (.6 + .4*np.sin(2*np.pi*t/9)) * .03
    if name == 'none':
        return np.zeros(t.size)
    own = os.path.abspath(os.path.join(folder, name + '.m4a'))
    x = load(own if os.path.exists(own) else os.path.join('beds', name + '.m4a'))
    return np.tile(x, t.size // x.size + 1)[:t.size] / (np.sqrt(np.mean(x**2)) + 1e-9) * .03
bed = np.zeros(t.size)
for i, (nm, g, a) in enumerate(specs):  # each bed fades in over 2 s at its start and out as the next one fades in
    w = np.clip((t - a + 1) / 2, 0, 1) if i else np.ones(t.size)
    if i + 1 < len(specs): w = w * np.clip(1 - (t - specs[i + 1][2] + 1) / 2, 0, 1)
    if nm != 'none': bed += one_bed(nm) * g * w
name = 'none' if all(sp[0] == 'none' for sp in specs) else 'mixed'
bed = bed * np.clip(t/2, 0, 1) * np.clip((DUR - t)/2.5, 0, 1)
L = int(SR * DUR); fx = out[:, :L]; bed = bed[:L]
# Keep the bed passive, behind the effects. Far away: dull above
# 1.2 kHz and a 2.5 s room. Steady: chirps and gusts are evened out so none pops forward. Lower (x0.6),
# and dipped up to 7.5 dB under each effect: fast in (30 ms), slow back (0.6 s).
if name != 'none':
    bed = sosfilt(butter(2, 1200, 'low', fs=SR, output='sos'), bed)
    W = int(SR * .4); rms = np.sqrt(np.convolve(bed**2, np.ones(W) / W, 'same')) + 1e-9
    bed = bed * np.clip((np.median(rms) / rms) ** .8, .25, 2.0)
    n2 = int(SR * 2.5); te2 = np.arange(n2) / SR
    h2 = np.random.default_rng(7).standard_normal(n2) * np.exp(-te2 * 2.2); h2 /= np.sqrt(np.sum(h2**2))
    bed = (.55 * bed + .45 * fftconvolve(bed, h2)[:bed.size]) * .6
    B = int(SR * .02); nb = L // B + 1
    e = np.abs(fx).max(0); e = np.pad(e, (0, nb * B - e.size)).reshape(nb, B).max(1)
    env = np.zeros(nb); a, r = 1 - np.exp(-.02 / .03), 1 - np.exp(-.02 / .6)
    for i in range(nb): p = env[i - 1] if i else 0; env[i] = p + (a if e[i] > p else r) * (e[i] - p)
    duck = 1 - .6 * np.clip(env / (env.max() * .25 + 1e-9), 0, 1)
    bed0 = bed.copy()  # as heard on its own, for the bed check below
    bed = bed * np.interp(np.arange(L), np.arange(nb) * B, duck)
raw = os.path.join(dest, 'audio-raw.wav'); dst = os.path.join(dest, 'audio.wav')
def wav(path, x): wavfile.write(path, SR, (np.clip(x.T, -1, 1) * 32767).astype(np.int16))
def lufs(x):  # integrated loudness, measured by ffmpeg
    wav(raw, x / (np.abs(x).max() + 1e-9) * .5)
    m = subprocess.run(['ffmpeg', '-hide_banner', '-i', raw, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    v = float(json.loads(m[m.rindex('{'):m.rindex('}') + 1])['input_i'])
    return v + 20 * np.log10((np.abs(x).max() + 1e-9) / .5)
# One fixed boost for every reel, never a loudness target. The old -16 LUFS target boosted a reel more the fewer sounds it had:
# the busy prophet-names reel got about 20 dB and sounded right, the sparse Roots mix got about 32 dB
# plus a limiter, and its soft sounds came out loud and sharp. So every reel now gets the 20 dB the
# prophet-names reel got, and each sound plays as loud as it did there. The whole mix is only turned
# down if a peak would pass -1 dB. The loudness is measured and printed.
mix = (fx + bed) * 10 ** (BOOST_DB / 20)
# Voice (references/sound.md, Voiceover): <reel-folder>/voice.wav plays from 0 s, centred, after the boost.
# It is set so its own loudest moment is VOICE_M LUFS momentary, with room under the -18 ceiling for a sound on top.
# The bed is set in bed.txt to stay below -36 LUFS on its own: felt more than heard. The bed check after the mix prints its level.
# While the voice talks the bed dips 10 dB more: in over 0.15 s, back over 0.8 s, so it
# does not pump between words and comes back up in the pauses.
VOICE_M = -19.5
vp = os.path.join(folder, 'voice.wav')
if os.path.exists(vp):
    v = load(os.path.abspath(vp))[:L]
    wav(raw, np.stack([v, v]) * .5)
    m = subprocess.run(['ffmpeg', '-hide_banner', '-i', raw, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    vm = max(float(s.split('M:')[1].split()[0]) for s in m.splitlines() if ' M:' in s and 'nan' not in s.split('M:')[1].split()[0])
    mix[:, :v.size] += v * .5 * 10 ** ((VOICE_M - vm) / 20)
    print('voice.wav', round(v.size / SR, 2), 's, loudest moment set to', VOICE_M, 'LUFS')
    if name != 'none':
        B = int(SR * .02); nb = v.size // B + 1
        e = np.pad(np.abs(v), (0, nb * B - v.size)).reshape(nb, B).max(1)
        env = np.zeros(nb); a, r = 1 - np.exp(-.02 / .15), 1 - np.exp(-.02 / .8)
        for i in range(nb): p = env[i - 1] if i else 0; env[i] = p + (a if e[i] > p else r) * (e[i] - p)
        vduck = 1 - .68 * np.clip(env / (env.max() * .25 + 1e-9), 0, 1)
        mix[:, :v.size] -= bed[:v.size] * (1 - np.interp(np.arange(v.size), np.arange(nb) * B, vduck)) * 10 ** (BOOST_DB / 20)
pk = np.abs(mix).max()
if pk > .89: mix = mix * (.89 / pk)
wav(dst, mix)
got = lufs(mix)
print('audio.wav', round(DUR, 2), 's,', len(events), 'events,', round(got, 1), 'LUFS (fixed +20 dB, no target)')
# Bed check: the bed alone, before any dip, must stay below -36 LUFS. Only warns.
BED_MAX = -36
if name != 'none':
    bl = lufs(np.stack([bed0, bed0]) * 10 ** (BOOST_DB / 20))
    print('bed alone', round(bl, 1), 'LUFS (max', BED_MAX, ')')
    if bl > BED_MAX: print(f'  BED TOO LOUD: {bl:.1f} LUFS; lower the gains in bed.txt (halving one is -6 dB)')
# Loudest moment: nothing above -18 LUFS momentary. Only warns; the fix is a lower `v` on the named event, in the page and sfx.json.
MAX_M = -18
mt = os.path.join(dest, 'momentary.txt')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', dst, '-af', 'ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=momentary.txt',
                '-f', 'null', '-'], check=True, cwd=dest)
mom, ts = [], None
for line in open(mt):
    if line.startswith('frame:'): ts = float(line.split('pts_time:')[1])
    elif line.startswith('lavfi.r128.M='): mom.append((ts, float(line.split('=')[1])))
os.remove(mt)
def start(e):  # when the sound really starts: kit sounds are placed so their sync point lands on t, a rise ends on t
    if e['type'].startswith('kit:'): return e['t'] - KIT[e['type'][4:]]['sync']['at']
    return e['t'] - 2.4 if e['type'] == 'rise' else e['t']
loud = {}
for ts, m in mom:
    if m > MAX_M:
        e = max((e for e in events if start(e) <= ts + .1), key=start, default=None)  # the last sound to start before then
        k = (e['t'], e['type']) if e else (0, 'bed')
        loud[k] = max(loud.get(k, -99), m)
print('loudest moment', round(max(m for _, m in mom), 1), 'LUFS (max', MAX_M, ')')
for (t0, ty), m in sorted(loud.items()):
    print(f'  TOO LOUD: {ty} at {t0} s reaches {m:.1f} LUFS; lower its v')
