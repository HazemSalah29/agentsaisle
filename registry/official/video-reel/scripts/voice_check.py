"""usage: python3 -I voice_check.py <reel-folder> [--model mlx-community/whisper-large-v3-turbo] [--min 0.9]

Speech-to-text check of a voice take: Whisper (mlx-whisper, on this Mac) listens to each line of voice.wav and
compares what it hears with voice-text.txt, so a skipped, misread or extra word, or a tag read out loud, is caught
without anyone listening. Idea from lemo-opuscar's asr_check.py (MIT), rewritten for our files.

Reads, in the reel folder:
  voice-text.txt   one paragraph per line, [tags] allowed (paragraph i is line Li)
  voice-times.js   window.VT = {"L0": [start, end], ...} as voice_prep.py writes it
  voice.wav        the prepared take
  voice-check.json optional: {"L8": "what Whisper should hear"} for a line Whisper always spells another way
Each line is cut with 0.4 s around it (short lines are misheard without it) and transcribed in English.
Compared word by word after dropping [tags], punctuation and case; numbers 0 to 99 are read as words on both sides.
Arabic-script words are left out of the expected text (Whisper cannot check them): the line is marked LISTEN, and
the extra words Whisper writes for them are allowed. A line FAILS when under --min of its words are heard, when it
has 2 or more extra words (an Arabic line excepted), or when a tag word is heard as an extra word.
Exit: 0 all pass, 1 some fail, 2 the check could not run. The Arabic words still need a human ear.
"""
import argparse, difflib, json, os, re, subprocess, sys, tempfile

ap = argparse.ArgumentParser()
ap.add_argument('folder')
ap.add_argument('--model', default='mlx-community/whisper-large-v3-turbo')
ap.add_argument('--min', type=float, default=0.9)
a = ap.parse_args()
d = os.path.abspath(a.folder)

try:
    import mlx_whisper
except ImportError:
    print('voice_check: NOT CHECKED. mlx-whisper is not installed (pip install mlx-whisper).', file=sys.stderr); sys.exit(2)
try:
    paras = [p.strip() for p in re.split(r'\n\s*\n', open(os.path.join(d, 'voice-text.txt'), encoding='utf-8').read()) if p.strip()]
    vt = json.loads(re.search(r'window\.VT\s*=\s*(\{.*?\})', open(os.path.join(d, 'voice-times.js'), encoding='utf-8').read(), re.S).group(1))
    wav = os.path.join(d, 'voice.wav'); assert os.path.exists(wav), 'voice.wav missing'
except Exception as e:
    print(f'voice_check: NOT CHECKED. {e}', file=sys.stderr); sys.exit(2)
over = json.load(open(os.path.join(d, 'voice-check.json'))) if os.path.exists(os.path.join(d, 'voice-check.json')) else {}
lines = [k for k in vt if re.fullmatch(r'L\d+', k)]
if len(lines) != len(paras):
    print(f'voice_check: NOT CHECKED. voice-text.txt has {len(paras)} paragraphs but voice-times.js has {len(lines)} lines.', file=sys.stderr); sys.exit(2)

ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split()
num = lambda n: ONES[n] if n < 20 else TENS[n // 10 - 2] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
ARABIC = re.compile(r'[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]')

def norm(s):
    s = re.sub(r'\[[^\]]*\]', ' ', s).lower().replace('’', "'")
    s = re.sub(r'\b(\d{1,2})\b', lambda m: num(int(m.group(1))), s)
    return [w for w in re.sub(r"[^\w\s']", ' ', s).split() if not ARABIC.search(w)]

def hear(tmp, k, s, e, pad=0.4):   # -> (text, gaps): gaps are quiet stretches inside the clip, in take seconds
    c0 = max(0, s - pad)
    clip = os.path.join(tmp, f'{k}-{s:.2f}.wav')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(c0), '-to', str(e + pad), '-i', wav, '-ac', '1', '-ar', '16000', clip], check=True)
    r = mlx_whisper.transcribe(clip, path_or_hf_repo=a.model, language='en', condition_on_previous_text=False, word_timestamps=True)
    ws = [w for sg in r['segments'] for w in sg.get('words', [])]
    edges = [s] + [x for w in ws for x in (c0 + w['start'], c0 + w['end'])] + [e]
    gaps = [(edges[n], edges[n + 1]) for n in range(0, len(edges) - 1, 2) if edges[n + 1] - edges[n] >= 0.6]
    gaps += [(c0 + w['start'], c0 + w['end']) for w in ws if w['end'] - w['start'] > 0.9]   # a stretched word hides a skip
    return r['text'].strip(), gaps

def heard_idx(want, got):   # which expected words this transcript contains, in order
    sm = difflib.SequenceMatcher(None, want, got, autojunk=False)
    return {b.a + n for b in sm.get_matching_blocks() for n in range(b.size)}, sm

bad = 0
with tempfile.TemporaryDirectory() as tmp:
    for i, k in enumerate(lines):
        s, e = vt[k]
        heard, gaps = hear(tmp, k, s, e)
        text = paras[i]
        want, got = norm(over.get(k, text)), norm(heard)
        tags = {w for t in re.findall(r'\[([^\]]*)\]', text) for w in norm(t)}
        idx, sm = heard_idx(want, got)
        if len(idx) < a.min * len(want):
            # Whisper sometimes skips a phrase inside a long clip that it hears fine alone ("peace be upon him",
            # 2026-11-01: it stretched "said" over 1.8 s). Listen again to each gap and each over-long word on its own.
            for gs, ge in gaps:
                idx |= heard_idx(want, norm(hear(tmp, k, gs, ge, pad=0.15)[0]))[0]
        hit = len(idx)
        missing = [w for n, w in enumerate(want) if n not in idx]
        extra = [w for op, i1, i2, j1, j2 in sm.get_opcodes() if op in ('insert', 'replace') for w in got[j1:j2]]
        has_ar = bool(ARABIC.search(text))
        score = hit / max(1, len(want))
        fail = score < a.min or (len(extra) >= 2 and not has_ar) or any(w in tags for w in extra)
        bad += fail
        mark = 'FAIL  ' if fail else ('LISTEN' if has_ar else 'OK    ')
        print(f'{mark} {k:<4} {score:4.0%}  heard: {heard!r}')
        if missing: print(f'         missing: {" ".join(missing)}')
        if extra: print(f'         extra:   {" ".join(extra)}{"  (tag read aloud)" if any(w in tags for w in extra) else ""}')
print(f'voice_check: {len(lines)} lines, {bad} fail')
sys.exit(1 if bad else 0)
