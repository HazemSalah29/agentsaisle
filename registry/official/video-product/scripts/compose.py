#!/usr/bin/env python3
"""Put a screenshot of an app or website on a styled background, as two layers for a parallax edit.

Usage: compose.py <screenshot> <out-dir> --size 1080x1920 [--accent #rrggbb]
Writes in <out-dir>: bg.jpg (a dark gradient with a soft glow in the accent colour), subject.png (the screenshot as a
rounded card with a thin edge and a soft shadow, transparent around it) and photo.jpg (the two together). The
screenshot is only read. No network, no other program.
Exit codes: 0 done, 2 bad usage or unreadable image, 3 OpenCV missing.
"""
import os
import sys


def fail(code, message):
    print(message, file=sys.stderr)
    return code


def main(argv):
    args = argv[1:]
    opts = {}
    for key in ("--size", "--accent"):
        if key in args:
            i = args.index(key)
            if i + 1 >= len(args):
                return fail(2, "%s needs a value" % key)
            opts[key] = args[i + 1]
            del args[i:i + 2]
    if len(args) != 2 or "--size" not in opts:
        return fail(2, "Usage: compose.py <screenshot> <out-dir> --size 1080x1920 [--accent #rrggbb]")
    src, out_dir = args
    try:
        w, h = [int(v) for v in opts["--size"].lower().split("x")]
        assert 200 <= w <= 4000 and 200 <= h <= 4000
    except Exception:
        return fail(2, "--size must look like 1080x1920")
    accent = opts.get("--accent", "#e8542a")
    try:
        r, g, b = int(accent[1:3], 16), int(accent[3:5], 16), int(accent[5:7], 16)
    except Exception:
        return fail(2, "--accent must look like #e8542a")
    try:
        import cv2
        import numpy as np
    except ImportError:
        return fail(3, "OpenCV is not installed in this Python (opencv-python-headless). Run /video doctor.")
    shot = cv2.imread(src, cv2.IMREAD_COLOR)
    if shot is None:
        return fail(2, "The screenshot could not be read (PNG, JPEG or WebP).")

    # Background: near-black vertical gradient with a soft glow of the accent behind the card.
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    base = 16 + 14 * (yy / h)
    bg = np.dstack([base, base, base + 2])
    glow = np.exp(-(((xx - w * 0.5) / (w * 0.55)) ** 2 + ((yy - h * 0.42) / (h * 0.32)) ** 2))[:, :, None]
    bg = np.clip(bg + glow * np.array([b, g, r], np.float32) * 0.28, 0, 255)
    bg = bg.astype(np.uint8)

    # Card: the screenshot scaled to fit inside 84% x 66% of the frame, leaving room above and below for type, with rounded corners.
    sh, sw = shot.shape[:2]
    k = min(0.84 * w / sw, 0.66 * h / sh)
    cw, ch = max(2, int(sw * k)), max(2, int(sh * k))
    card = cv2.resize(shot, (cw, ch), interpolation=cv2.INTER_AREA if k < 1 else cv2.INTER_CUBIC)
    rad = max(8, int(min(cw, ch) * 0.045))
    mask = np.zeros((ch, cw), np.uint8)
    cv2.rectangle(mask, (rad, 0), (cw - rad, ch), 255, -1)
    cv2.rectangle(mask, (0, rad), (cw, ch - rad), 255, -1)
    for cx, cy in ((rad, rad), (cw - rad, rad), (rad, ch - rad), (cw - rad, ch - rad)):
        cv2.circle(mask, (cx, cy), rad, 255, -1)
    x0, y0 = (w - cw) // 2, (h - ch) // 2

    layer = np.zeros((h, w, 4), np.uint8)
    full_mask = np.zeros((h, w), np.uint8)
    full_mask[y0:y0 + ch, x0:x0 + cw] = mask
    # Soft shadow below and around the card.
    shadow = cv2.GaussianBlur(np.roll(full_mask, int(h * 0.012), axis=0).astype(np.float32), (0, 0), max(6, w / 45)) * (0.55 / 255.0)
    layer[:, :, 3] = np.clip(shadow * 255, 0, 255).astype(np.uint8)
    # Card pixels (with a thin light edge) over the shadow.
    edge = cv2.GaussianBlur(full_mask, (0, 0), 1.2)
    ring = np.clip(full_mask.astype(np.int16) - cv2.erode(full_mask, np.ones((3, 3), np.uint8)).astype(np.int16), 0, 255).astype(np.uint8)
    canvas = np.zeros((h, w, 3), np.uint8)
    canvas[y0:y0 + ch, x0:x0 + cw] = card
    canvas[ring > 0] = (235, 235, 235)
    a = (edge.astype(np.float32) / 255.0)[:, :, None]
    sa = (layer[:, :, 3].astype(np.float32) / 255.0)[:, :, None]
    out_rgb = canvas.astype(np.float32) * a
    out_a = np.clip(a + sa * (1 - a), 0, 1)
    rgb = np.where(out_a > 0, out_rgb / np.maximum(out_a, 1e-6), 0)
    subject = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), (out_a[:, :, 0] * 255).astype(np.uint8)])
    photo = (bg.astype(np.float32) * (1 - out_a) + canvas.astype(np.float32) * a + bg.astype(np.float32) * 0).astype(np.uint8)
    photo = (bg.astype(np.float32) * (1 - a) * (1 - sa * 0.0) + canvas.astype(np.float32) * a).astype(np.uint8)
    # The shadow darkens the background under it.
    photo = (photo.astype(np.float32) * (1 - sa * (1 - a))).astype(np.uint8)

    os.makedirs(out_dir, exist_ok=True)
    cv2.imwrite(os.path.join(out_dir, "bg.jpg"), bg, [cv2.IMWRITE_JPEG_QUALITY, 92])
    cv2.imwrite(os.path.join(out_dir, "subject.png"), subject)
    cv2.imwrite(os.path.join(out_dir, "photo.jpg"), photo, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print("composed %dx%d card on a %dx%d frame" % (cw, ch, w, h))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
