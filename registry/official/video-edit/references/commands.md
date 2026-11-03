# Commands

Every command: `node <skill>/scripts/edit.mjs <command> --in <file> --out <new-file> [options] [--best] [--force]`. `--best` uses a slower, larger encode (CRF 16, preset slow); the default is CRF 20, preset veryfast, H.264, yuv420p, AAC 48 kHz. An existing output needs `--force`; the output may never be the input. Two runs on the same input give the same bytes.

| Command      | What it does                                                                                                                                                                 | Options                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `trim`       | Keeps one stretch, cut exactly (re-encoded).                                                                                                                                 | `--from 1.5 --to 8` (seconds)                                           |
| `join`       | Puts clips one after another at the first clip's size and frame rate. All clips need sound, or none.                                                                         | `--in a.mp4,b.mp4,c.mp4`                                                |
| `speed`      | Faster or slower, sound kept in pitch.                                                                                                                                       | `--factor 0.25..4`                                                      |
| `gif`        | A looping gif, up to 15 s, one colour palette for the whole clip.                                                                                                            | `--from --to --width 64..720 --fps 5..20`                               |
| `scenes`     | Lists where the picture cuts, the average shot length and cuts a minute. Writes JSON with `--out`. Brightness-based: two shots of the same brightness are not seen as a cut. | `--threshold 1..60` (default 10)                                        |
| `audio`      | Two-pass loudness to -14 LUFS (peak -1.5 dBTP), keeping dynamics; the picture is copied. Refuses silence.                                                                    | `--target -30..-8`, `--denoise`, `--music file [--duck]`                |
| `color`      | A look, a LUT, or an automatic white balance (grayworld).                                                                                                                    | `--look warm\|cool\|film`, `--lut file.cube`, `--auto-wb`               |
| `stabilize`  | Two-pass vidstab; the correction crops the picture a little.                                                                                                                 | `--strength low\|normal\|high`                                          |
| `jumpcut`    | Eased punch-in zooms (1.05 to 1.3) at times you give, same size and length.                                                                                                  | `--marks marks.json`                                                    |
| `cut`        | Removes long pauses and fillers (see `cut.md`).                                                                                                                              | `--pause --breath --noise --lang --words --silence-only --apply --plan` |
| `transcribe` | Words with measured times from whisper.cpp, to a json file.                                                                                                                  | `--lang en\|ar`                                                         |
| `reframe`    | Wide to vertical (see `reframe.md`).                                                                                                                                         | `--mode --size --detections --plan`                                     |

`marks.json` is a list of seconds, or of `{ "t": 1.5, "hold": 0.8, "zoom": 1.12 }`. Marks must be at least 1 second plus the hold apart. Choose marks from the transcript's emphasis and show them to the user first; the zoom is deterministic, so the same marks give the same video.

## Safety

File names are checked before ffmpeg sees them: no URLs, no pseudo-files (`concat:`, `pipe:`), no leading `-`, no control characters, and only the `file` protocol is allowed. Programs start through `run.mjs` (ffmpeg, ffprobe, whisper-cli, our own python script) with argument lists and no shell. A failed run removes the half-written media file.
