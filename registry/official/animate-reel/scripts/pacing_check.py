"""pacing_check.py: finds flashes in a rendered reel from its pixels (Workflow step 8).

usage: python3 pacing_check.py <reel.mp4> [--min-hold 0.3]

Checks that nothing flashes: no shot shorter than --min-hold between two hard cuts, and nothing
that pops in and out again inside --min-hold. Hold lengths are not checked: the user judges
them in the preview, because a gap limit cuts good reading pauses.
Also writes fast-action strips (12 frames in a row, <reel>-strip-<s>.jpg) at the two fastest moments and at
every flash, and, when sfx.json sits next to the video (render.sh puts it there), a sound sync report:
each sound should land on the frame its picture changes, or 1 to 2 frames after, never before. A kit sound is
checked against its own kind of moment (sounds.json sync.meets): a whoosh (move-peak) against the fastest frame
of its move, a riser (arrival) against the frame the move stops, the rest against the frame a change starts or
stops. The sfx.json time is the moment itself (mix.py starts the file sync.at early), so a page that subtracts
sync.at by hand shows up here as early. The sync
report is a pointer, not proof: another moving thing (a glow, the camera) can fool it, so confirm each WARN on a strip.
Writes <reel>-pacing.json next to the video. Exit 0 = pass, 1 = fail (sync is reported, never a fail).
Adapted from claude-video-2 (MIT, github.com/ItsssssJack/claude-video-2)."""
import argparse, json, os, subprocess, sys
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('video')
ap.add_argument('--min-hold', type=float, default=0.3)
a = ap.parse_args()

info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                           'stream=width,height:format=duration', '-of', 'json', a.video]))
W, H = info['streams'][0]['width'], info['streams'][0]['height']
dur = float(info['format']['duration'])

h = int(round(160 * H / W / 2) * 2)
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', a.video, '-vf',
                               f'fps=30,scale=160:{h},format=gray', '-f', 'rawvideo', '-'])
f30 = np.frombuffer(raw, np.uint8).reshape(-1, h, 160).astype(np.int16)


def moved(x, y, thr=30):
    return float((np.abs(x - y) > thr).mean())


k = max(1, int(round(a.min_hold / 2 * 30)))
cuts = [i / 30 for i in range(1, len(f30)) if moved(f30[i - 1], f30[i]) > 0.35]
flashes = []
for i in range(k, len(f30) - k, 2):
    ac, ab = moved(f30[i - k], f30[i]), moved(f30[i - k], f30[i + k])
    if ac > 0.01 and ab < 0.25 * ac:
        flashes.append(round(i / 30, 2))
shots = [0.0] + cuts + [dur]
short = [(round(shots[i], 2), round(shots[i + 1], 2)) for i in range(len(shots) - 1)
         if shots[i + 1] - shots[i] < a.min_hold - 0.01]
merged = []
for t in flashes:
    if merged and t - merged[-1][1] <= 0.1:
        merged[-1][1] = t
    else:
        merged.append([t, t])

base = os.path.splitext(a.video)[0]
motion = np.array([0.0] + [moved(f30[i - 1], f30[i], 12) for i in range(1, len(f30))])


def strip(t0):
    n0 = max(0, min(len(f30) - 12, int(round(t0 * 30)) - 4))
    out = f"{base}-strip-{n0 / 30:.1f}.jpg"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.video, '-vf',
                    f"select='between(n\\,{n0}\\,{n0 + 11})',scale=270:-1,tile=6x2", '-frames:v', '1', out], check=True)
    return out


win = np.convolve(motion, np.ones(12), 'same')
fast = []
for i in np.argsort(win)[::-1]:
    if all(abs(int(i) - j) > 45 for j in fast): fast.append(int(i))
    if len(fast) == 2: break
strips = [strip(i / 30) for i in fast] + [strip(m[0]) for m in merged]

KIT = {k['id']: k['sync']['meets'] for k in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                  '..', 'assets', 'sfx-kit', 'sounds.json')))['sounds']}


def sync_report(events, motion, fps=30):
    """Each sound against the frame it should meet; returns the ones off their picture."""
    out = []
    for e in events:
        meets = KIT.get(e['type'][4:], 'instant') if e['type'].startswith('kit:') else 'instant'
        reach = 0.6 if meets == 'move-peak' else 0.3  # a slow move's peak can sit half a second from the sound
        lo, hi = max(1, int((e['t'] - reach) * fps)), min(len(motion) - 1, int((e['t'] + reach) * fps))
        w = motion[lo:hi + 1]
        if not len(w) or w.max() < 0.002 or w.max() < 3 * np.median(w):
            continue  # no clear change on screen here (a bed, a slow swell): nothing to sync to
        dw = np.diff(w)
        if meets == 'move-peak':  # a whoosh belongs to the fastest frame of its move
            keys, early, late = [lo + int(w.argmax())], -0.07, 0.15
        elif meets == 'arrival':  # a riser or zip-in ends where the move stops
            keys, early, late = [lo + 1 + int(dw.argmin())], -0.02, 0.25
        else:  # a pop belongs to the frame a change starts, a landing to the frame it stops
            keys, early, late = [lo + 1 + int(dw.argmax()), lo + 1 + int(dw.argmin())], -0.02, 0.25
        keys = [k for k in keys if lo + 2 < k < hi - 2]  # at the window's edge it is another beat's motion
        if not keys:
            continue
        off = round(min((e['t'] - k / fps for k in keys), key=abs), 3)  # sound minus picture, seconds
        if off < early or off > late:  # a little late is natural; early never is
            out.append({'t': e['t'], 'sound': e['type'], 'meets': meets, 'sound_minus_picture_s': off})
    return out


sfx = os.path.join(os.path.dirname(os.path.abspath(a.video)), 'sfx.json')
sync = sync_report(json.load(open(sfx))['events'], motion) if os.path.exists(sfx) else []

rep = {'video': a.video, 'duration': round(dur, 2), 'hard_cuts': [round(c, 2) for c in cuts],
       'too_short_shots': short, 'flashes': merged, 'strips': strips,
       'sync_off': sync, 'pass': not short and not merged}
json.dump(rep, open(base + '-pacing.json', 'w'), indent=1)
print(f"flashes: {len(cuts)} hard cuts in {round(dur, 2)} s")
for s in short:
    print(f"  FAIL shot {s[0]} to {s[1]} s is shorter than {a.min_hold} s")
for m in merged:
    print(f"  FAIL something pops in and out around {m[0]} to {m[1]} s")
for p in strips:
    print(f"  strip: {p}")
if os.path.exists(sfx):
    print(f"sync: {len(sync)} sounds off their picture" + ('' if sync else ' (all land on time)'))
    for x in sync:
        when = 'BEFORE' if x['sound_minus_picture_s'] < 0 else 'after'
        print(f"  WARN {x['sound']} at {x['t']} s plays {abs(x['sound_minus_picture_s'])} s {when} its picture ({x['meets']})")
print('PASS' if rep['pass'] else 'FAIL')
sys.exit(0 if rep['pass'] else 1)
