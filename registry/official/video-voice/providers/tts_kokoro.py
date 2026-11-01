#!/usr/bin/env python3
"""Kokoro-82M English voice for video-voice. (The file is not called kokoro.py: Python would import it
instead of the kokoro package.) Called through the runner with a fixed argument list.

    tts_kokoro.py --text-file T --out O.wav --voice af_heart --speed 1.0 --seed 1

Writes a 24 kHz mono 16-bit WAV and prints one JSON line {"model": ..., "sampleRate": ...}.
It never downloads anything: the model must already be in the local Hugging Face cache (the setup step
puts it there), and offline mode is forced so a missing file is an error, not a fetch.
Exit codes: 0 ok, 2 bad arguments, 3 kokoro or its libraries are not installed, 4 synthesis failed.
"""
import argparse
import json
import os
import re
import sys

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

VOICE = re.compile(r"^[a-z]{2}_[a-z]+$")  # an id like af_heart, never a path
REPO = "hexgrad/Kokoro-82M"
RATE = 24000


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--text-file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    if not VOICE.match(a.voice):
        print(f"voice must be an id like af_heart, got {a.voice[:30]!r}", file=sys.stderr)
        return 2
    if not 0.5 <= a.speed <= 2.0:
        print("speed must be between 0.5 and 2.0", file=sys.stderr)
        return 2
    try:
        import numpy as np
        import soundfile as sf
        import torch
        from kokoro import KPipeline
    except ImportError as e:  # pragma: no cover - depends on the machine
        print(f"kokoro is not installed in this Python: {e}", file=sys.stderr)
        return 3
    try:
        with open(a.text_file, encoding="utf-8") as f:
            text = f.read().strip()
        torch.manual_seed(a.seed)
        np.random.seed(a.seed)
        # af_/am_ are American English, bf_/bm_ British English
        pipeline = KPipeline(lang_code="b" if a.voice.startswith("b") else "a", repo_id=REPO)
        parts = []
        for _gs, _ps, audio in pipeline(text, voice=a.voice, speed=a.speed):
            parts.append(audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio))
        if not parts:
            print("kokoro made no audio for this text", file=sys.stderr)
            return 4
        sf.write(a.out, np.concatenate(parts), RATE, subtype="PCM_16")
    except Exception as e:  # noqa: BLE001 - report any failure as one line
        print(f"kokoro failed: {type(e).__name__}: {e}", file=sys.stderr)
        return 4
    print(json.dumps({"model": REPO, "sampleRate": RATE}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
