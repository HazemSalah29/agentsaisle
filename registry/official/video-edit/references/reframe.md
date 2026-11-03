# reframe: wide to vertical

`reframe --in wide.mp4 --out vertical.mp4 [--mode face|center|left|right|x=0.4] [--size 1080x1920]`. The crop is the full height and the width of the target shape; it must be narrower than the picture.

## Modes

- `face` (default): follows the biggest face. `face_track.py` (OpenCV Haar cascade) samples 3 frames a second and writes only positions. The path is smoothed: a wrong detection in one sample is ignored, the crop does not move for small wobble (under 8% of its width), it moves at most half its width a second, and it never leaves the picture. Where no face is found it holds its last place. At least 20% of samples must have a face, or the command stops and suggests a fixed mode.
- `center`, `left`, `right`, `x=0.4` (the middle of the crop at 40% of the width): a fixed crop.
- `--detections faces.json`: skip the detector with a list of `{ "t", "cx" }` (cx as a fraction of the width, or null).
- `--plan path.json` writes the keyframes (left edge in pixels over time) for review.

## Install (optional, once)

OpenCV 4.14.0.94 (opencv-python-headless, Apache 2.0, about 120 MB) goes into the library's Python venv; `/video doctor` shows `opencv ready` when it is there (`docs/video/THIRD_PARTY.md`). Never install it for the user without asking.

## Limits

Haar finds frontal faces. It can miss profiles, hats, masks, poor light and small faces, and with several people it follows the biggest. The detector was exercised on synthetic data and on a clip with no face; the path maths is tested, the detection quality on real faces is for the user to check on their own footage. The command reports the face coverage; if it is low, use a fixed mode.
