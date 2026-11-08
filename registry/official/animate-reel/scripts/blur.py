"""blur.py: motion blur for fast frames only (a 180-degree film shutter), run by render.sh.

usage: python3 blur.py detect <frames-dir> <list.json>    finds fast frames, writes {frame: subframes}
       python3 blur.py merge  <frames-dir> <sub-dir>      averages each frame's subframes over its JPEG

A frame whose picture changes a lot from its neighbours gets 2 to 8 subframes spread over half a frame,
averaged in linear light. Slow frames are left as they are, so a calm reel renders almost as fast as before.
No tokens: it all runs on the Mac."""
import json, os, sys
import numpy as np
from PIL import Image

mode, frames = sys.argv[1], sys.argv[2]
names = sorted(f for f in os.listdir(frames) if f.endswith('.jpg'))

if mode == 'detect':
    def small(n):
        im = Image.open(os.path.join(frames, n)); im.draft('L', (135, 240))
        return np.asarray(im.convert('L').resize((90, 160)), np.float32)
    g = [small(n) for n in names]
    d = [0.0] + [float(np.abs(g[i] - g[i - 1]).mean()) for i in range(1, len(g))] + [0.0]
    out = {}
    for i in range(len(g)):
        e = max(d[i], d[i + 1])  # change to the previous or the next frame, 0 to 255
        if e > 1.5:  # below this the eye sees no smear
            out[int(names[i][:-4])] = int(min(8, max(2, round(e / 1.5))))
    json.dump(out, open(sys.argv[3], 'w'))
    print(f'blur: {len(out)} of {len(g)} frames are fast, {sum(out.values())} subframes to capture')
else:
    sub = sys.argv[3]
    by = {}
    for f in os.listdir(sub):
        if f.endswith('.jpg'): by.setdefault(f.split('_')[0], []).append(f)
    for k, fs in by.items():
        acc = sum((np.asarray(Image.open(os.path.join(sub, f)), np.float32) / 255) ** 2.2 for f in fs)
        img = ((acc / len(fs)) ** (1 / 2.2) * 255).round().clip(0, 255).astype(np.uint8)
        Image.fromarray(img).save(os.path.join(frames, k + '.jpg'), quality=92)
    print(f'blur: merged {len(by)} frames')
