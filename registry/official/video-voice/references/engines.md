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
