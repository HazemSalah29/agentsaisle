#!/usr/bin/env python3
"""Find the main face in a video, a few times a second, and write where it is.

Usage: face_track.py <video> <out.json> [--fps 3]
Writes a list of {"t": seconds, "cx": 0..1 or null, "size": 0..1 or null}: the middle of the biggest face as a
fraction of the picture width, or null when no face was found. It only reads the video and writes that one file.
Detection is OpenCV's built-in Haar cascade (frontal faces), on a downscaled copy, so it is quick on a CPU and
weak on profiles, hats, masks and small faces; the caller reports how often a face was found.
"""
import json
import sys


def main(argv):
    if len(argv) < 3:
        print("Usage: face_track.py <video> <out.json> [--fps 3]", file=sys.stderr)
        return 2
    video, out = argv[1], argv[2]
    fps = 3.0
    if "--fps" in argv:
        fps = float(argv[argv.index("--fps") + 1])
    if not 0.5 <= fps <= 10:
        print("--fps must be from 0.5 to 10", file=sys.stderr)
        return 2
    try:
        import cv2  # noqa: WPS433 (imported late so the error can name the fix)
    except ImportError:
        print("OpenCV is not installed in this Python (opencv-python-headless). See the video-edit references.", file=sys.stderr)
        return 3
    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        print("Cannot open the video.", file=sys.stderr)
        return 2
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    if cascade.empty():
        print("OpenCV's face model is missing.", file=sys.stderr)
        return 3
    step = max(1, int(round(src_fps / fps)))
    samples = []
    index = 0
    while True:
        ok = cap.grab()
        if not ok:
            break
        if index % step == 0:
            ok, frame = cap.retrieve()
            if not ok:
                break
            h, w = frame.shape[:2]
            scale = 480.0 / w if w > 480 else 1.0
            small = cv2.resize(frame, (int(w * scale), int(h * scale))) if scale != 1.0 else frame
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(max(24, small.shape[1] // 20),) * 2)
            t = round(index / src_fps, 3)
            if len(faces):
                x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
                samples.append({"t": t, "cx": round((x + fw / 2) / small.shape[1], 4), "size": round(fw / small.shape[1], 4)})
            else:
                samples.append({"t": t, "cx": None, "size": None})
        index += 1
    cap.release()
    with open(out, "w", encoding="utf-8") as f:
        json.dump(samples, f)
    found = sum(1 for s in samples if s["cx"] is not None)
    print(f"{found} of {len(samples)} samples have a face ({total} frames read)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
