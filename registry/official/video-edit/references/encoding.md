# Encoding and determinism

- Video: H.264 (libx264), yuv420p, CRF 20, preset veryfast (`--best`: CRF 16, preset slow). Sound: AAC 192 kb/s, 48 kHz. `+faststart` so a file plays before it has fully downloaded.
- `-fflags +bitexact` and `-flags +bitexact`: the same input and options give the same bytes.
- Commands that do not touch the picture (`audio`) copy it; commands that do not touch the sound (`color`, `stabilize`, `jumpcut`, `reframe`) copy the sound.
- Loudness: -14 LUFS integrated, -1.5 dBTP true peak, the same numbers `video-core` renders with. These are working defaults, `TODO(verify)` per platform. YouTube is widely reported to normalise around -14 LUFS, but no official page was found when this was checked.
