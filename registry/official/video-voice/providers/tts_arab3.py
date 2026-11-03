#!/usr/bin/env python3
"""3arab-TTS Arabic voice for video-voice. Called through the runner with a fixed argument list.

    tts_arab3.py --text-file T --out O.wav --voice "<Arabic description of the voice>" --speed 1.0 --seed 1

The voice is a short Arabic description (the model's "VoiceDesign" mode), for example
"صوت هادئ وواضح بلهجة فصحى". Writes a 48 kHz WAV (with the model's built-in SilentCipher watermark when the
silentcipher package is installed) and prints one JSON line {"model": ..., "sampleRate": ...}.
It reads two paths from ~/.aisle-video/tools.json ("arab3": the 3arab-TTS checkout, "arab3Model": the local
model.safetensors), runs on the CPU, and never downloads: offline mode is forced, so the codec and tokenizer must
already be in the local Hugging Face cache (the setup step puts them there).
Exit codes: 0 ok, 2 bad arguments, 3 not set up or libraries missing, 4 synthesis failed.
"""
import argparse
import json
import os
import sys

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

MODEL = "sherif1313/3arab-TTS-500M-v2-VoiceDesign"
ARABIC = range(0x0600, 0x0700)


def tools() -> dict:
    try:
        with open(os.path.join(os.path.expanduser("~"), ".aisle-video", "tools.json"), encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--text-file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", required=True)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    voice = a.voice.strip()
    if not 3 <= len(voice) <= 120 or any(ord(c) < 32 for c in voice):
        print("voice must be a short Arabic description of the voice (3 to 120 characters)", file=sys.stderr)
        return 2
    if not any(ord(c) in ARABIC for c in voice):
        print("voice must be described in Arabic, for example: صوت هادئ وواضح بلهجة فصحى", file=sys.stderr)
        return 2
    if not 0.5 <= a.speed <= 2.0:
        print("speed must be between 0.5 and 2.0", file=sys.stderr)
        return 2
    cfg = tools()
    repo, ckpt = cfg.get("arab3"), cfg.get("arab3Model")
    if not (isinstance(repo, str) and os.path.isdir(repo) and isinstance(ckpt, str) and os.path.isfile(ckpt)):
        print("3arab-tts is not set up: tools.json needs arab3 (the checkout) and arab3Model (the model file)", file=sys.stderr)
        return 3
    try:
        with open(a.text_file, encoding="utf-8") as f:
            text = f.read().strip()
        sys.path.insert(0, repo)
        import infer  # the checkout's own command-line entry point; its defaults are the model's recommended ones
        import soundfile as sf
    except ImportError as e:  # pragma: no cover - depends on the machine
        print(f"3arab-tts is not installed in this Python: {e}", file=sys.stderr)
        return 3
    try:
        sys.argv = [
            "infer.py", "--checkpoint", ckpt, "--text", text, "--caption", voice, "--no-ref",
            "--model-device", "cpu", "--codec-device", "cpu", "--seed", str(a.seed),
            "--duration-scale", str(round(1.0 / a.speed, 4)), "--output-wav", a.out, "--no-show-timings",
        ]
        infer.main()
        rate = sf.info(a.out).samplerate
    except SystemExit as e:  # argparse errors inside infer.py
        print(f"3arab-tts failed: the model script exited with {e.code}", file=sys.stderr)
        return 4
    except Exception as e:  # noqa: BLE001 - report any failure as one line
        print(f"3arab-tts failed: {type(e).__name__}: {e}", file=sys.stderr)
        return 4
    print(json.dumps({"model": MODEL, "sampleRate": rate}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
