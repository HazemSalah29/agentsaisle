# Voice and caption engines

The skill never installs anything and its scripts never fetch models. Setup is done once by the user (or by the agent after the user approves each step), then `~/.aisle-video/tools.json` points at the tools:

```
{ "python": "/abs/venv/bin/python", "whisper-cli": "/abs/whisper-cli",
  "whisperModel": "/abs/ggml-base.bin", "arab3": "/abs/3arab-TTS" }
```

Everything lives outside the repo, under `~/.aisle-video` by default.

| Engine                                                           | Use                                      | Licence                                                        | Notes                                                                                                                                       |
| ---------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Kokoro-82M (`pip install kokoro soundfile`, Python 3.10 to 3.12) | English voice                            | Apache 2.0                                                     | 24 kHz. Arabic is not supported. Weights come from the Hugging Face cache; the adapter forces offline mode.                                 |
| 3arab-TTS-500M-v2                                                | Arabic voice (Modern Standard, Egyptian) | Apache 2.0 (the v1 base licence is not stated, `TODO(verify)`) | 48 kHz, Arabic text only, numbers as words, built-in watermark. CPU speed unverified.                                                       |
| whisper.cpp (`whisper-cli`) and a ggml model                     | Measured word times                      | MIT                                                            | 16 kHz WAV input (the script converts). `-ml 1` word timestamps are marked experimental upstream. Model sizes: base 142 MiB, small 466 MiB. |
| test provider                                                    | Offline timing preview                   | none                                                           | A tone, not speech.                                                                                                                         |

Without whisper, captions use estimated word times and say so.

`/video doctor` shows which engines are ready.

## What was measured (one machine, one run; not a promise)

Apple Silicon Mac, CPU only, 2026-11-01, versions pinned in `docs/video/THIRD_PARTY.md`.

- **Kokoro**: 5.0 s of speech (two lines) in about 9.5 s wall time, including loading the model once per line.
- **Word times, compared with Kokoro's own per-word times** on 52 words in 6 sentences (those times are a model's prediction, not a stopwatch):

  | Method                                          | median error | mean error | words within 100 ms |
  | ----------------------------------------------- | ------------ | ---------- | ------------------- |
  | whisper.cpp `base`, DTW (the default here)      | 35 ms        | 68 ms      | 43 of 52 (83%)      |
  | whisper.cpp `base`, per-word segments (`-ml 1`) | 125 ms       | 149 ms     | 23 of 52 (44%)      |
  | estimate (letters over audio length)            | 162 ms       | 191 ms     | 18 of 52 (35%)      |

  The brief asks for within 100 ms; the DTW method does not reach that on every word (one word was 525 ms off). A larger model (`small`, 466 MiB) may do better; it was not tested.

## Setup notes (done once, by the user or by the agent with each step approved)

- Python 3.12 in a venv (no Homebrew needed): `python3 -m pip install --user uv`, then `uv python install 3.12` and `uv venv`. Kokoro needs Python 3.10 to 3.12.
- `uv pip install kokoro==0.9.4 soundfile`, the spaCy model `en_core_web_sm` 3.8.0 (misaki downloads it at run time otherwise, which the offline adapter forbids), and the Kokoro weights through `huggingface_hub.snapshot_download` (the adapter itself never downloads).
- whisper.cpp v1.9.5: shallow `git clone` of the tag, cmake from pip, and on Apple Silicon configure with `-DGGML_NATIVE=OFF -DGGML_CPU_ARM_ARCH=armv8.5-a+dotprod+i8mm` (the SVE probe hung the default configure); build the `whisper-cli` target; fetch `ggml-base.bin`.
- Record the absolute paths in `~/.aisle-video/tools.json`.
