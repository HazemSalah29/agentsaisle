#!/usr/bin/env python3
"""Trace a child's drawing (a PNG or JPEG of crayon or marker on plain paper) into flat colour regions.

Usage: trace.py <drawing.png|jpg> <out.json>
Writes {"aspect", "palette", "regions": [{"id", "color", "area", "bbox", "polygon"}]} with every coordinate as a
fraction (0 to 1) of the box around all the ink. It reads one image and writes one JSON file; it opens no network
connection and starts no program.
Exit codes: 0 ok, 2 bad usage or unreadable image, 3 OpenCV missing, 4 refused because the picture looks like a
photo (a face was found, or there is no plain paper background), 5 nothing drawn was found.
The photo check is a guard, not a guarantee: the parent confirms the picture is a drawing as well.
"""
import json
import sys

MAX_SIDE = 512
MAX_COLOURS = 6
MAX_REGIONS = 24
MAX_POINTS = 60
MIN_AREA = 0.004  # fraction of the picture a shape must cover to be kept
PAPER_SHARE = 0.4  # at least this share of the picture must look like plain paper (working default, TODO(verify))
MAX_RESIDUAL = 28.0  # mean colour distance of ink to its nearest of 6 colours; photos are continuous tone (TODO(verify))


def fail(code, message):
    print(message, file=sys.stderr)
    return code


def magic_ok(path):
    with open(path, "rb") as f:
        head = f.read(8)
    return head.startswith(b"\x89PNG\r\n\x1a\n") or head.startswith(b"\xff\xd8\xff")


def main(argv):
    if len(argv) != 3:
        return fail(2, "Usage: trace.py <drawing.png|jpg> <out.json>")
    src, out = argv[1], argv[2]
    try:
        import cv2
        import numpy as np
    except ImportError:
        return fail(3, "OpenCV is not installed in this Python (opencv-python-headless). See the video-drawing references.")
    try:
        if not magic_ok(src):
            return fail(2, "Only PNG and JPEG drawings are read.")
    except OSError as e:
        return fail(2, "Cannot read the drawing: %s" % e)
    img = cv2.imread(src, cv2.IMREAD_COLOR)
    if img is None:
        return fail(2, "The image could not be decoded.")
    h, w = img.shape[:2]
    scale = min(1.0, MAX_SIDE / float(max(h, w)))
    if scale < 1.0:
        img = cv2.resize(img, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
    h, w = img.shape[:2]

    # Guard 1: a face means this is a photo of a person, not a drawing.
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    if not cascade.empty():
        faces = cascade.detectMultiScale(gray, 1.1, 6, minSize=(max(24, w // 12), max(24, h // 12)))
        if len(faces):
            return fail(4, "Refused: a face was found, so this looks like a photo. Only drawings are used.")

    # Guard 2: a drawing sits on plain paper. Find the paper colour from the border.
    blur = cv2.medianBlur(img, 5)
    border = np.concatenate([blur[0, :], blur[-1, :], blur[:, 0], blur[:, -1]]).astype(np.float32)
    paper = np.median(border, axis=0)
    dist = np.linalg.norm(blur.astype(np.float32) - paper, axis=2)
    if float((dist < 40).mean()) < PAPER_SHARE:
        return fail(4, "Refused: no plain paper background found. Photograph or scan the drawing on plain paper and crop closely.")

    ink = dist >= 45
    ink = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    ys, xs = np.nonzero(ink)
    if len(xs) < MIN_AREA * w * h:
        return fail(5, "Nothing drawn was found on the paper.")
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    bw, bh = float(x1 - x0), float(y1 - y0)

    pix = blur[ink].astype(np.float32)
    if len(pix) > 20000:
        pix = pix[np.random.RandomState(7).choice(len(pix), 20000, replace=False)]
    k = max(1, min(MAX_COLOURS, len(pix)))
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    cv2.setRNGSeed(7)
    _, labels_k, centres = cv2.kmeans(pix, k, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    centres = centres.astype(np.float32)
    if float(np.linalg.norm(pix - centres[labels_k.ravel()], axis=1).mean()) > MAX_RESIDUAL:
        return fail(4, "Refused: the colours blend smoothly like a photo. Only flat crayon, marker or paint drawings are used.")
    flat = blur.reshape(-1, 3).astype(np.float32)
    nearest = np.argmin(((flat[:, None, :] - centres[None, :, :]) ** 2).sum(axis=2), axis=1).reshape(h, w)

    def to_hex(c):
        return "#%02x%02x%02x" % (int(c[2]), int(c[1]), int(c[0]))

    regions = []
    for ci in range(k):
        mask = ((nearest == ci) & ink).astype(np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        for li in range(1, n):
            area = int(stats[li, cv2.CC_STAT_AREA])
            if area < MIN_AREA * w * h:
                continue
            cnts, _ = cv2.findContours((labels == li).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not cnts:
                continue
            cnt = max(cnts, key=cv2.contourArea)
            peri = cv2.arcLength(cnt, True)
            eps = 0.008 * peri
            poly = cv2.approxPolyDP(cnt, eps, True)
            while len(poly) > MAX_POINTS:
                eps *= 1.3
                poly = cv2.approxPolyDP(cnt, eps, True)
            if len(poly) < 3:
                continue
            pts = [[round((float(p[0][0]) - x0) / bw, 4), round((float(p[0][1]) - y0) / bh, 4)] for p in poly]
            bx, by, bww, bhh = stats[li, 0], stats[li, 1], stats[li, 2], stats[li, 3]
            regions.append({
                "color": to_hex(centres[ci]),
                "area": round(area / float(w * h), 4),
                "bbox": [round((bx - x0) / bw, 4), round((by - y0) / bh, 4), round(bww / bw, 4), round(bhh / bh, 4)],
                "polygon": pts,
            })
    regions.sort(key=lambda r: -r["area"])
    regions = regions[:MAX_REGIONS]
    for i, r in enumerate(regions):
        r["id"] = "r%d" % (i + 1)
    palette = []
    for r in regions:
        if r["color"] not in palette:
            palette.append(r["color"])
    result = {"aspect": round(bw / bh, 4), "paper": to_hex(paper), "palette": palette[:6], "regions": regions}
    with open(out, "w", encoding="utf8") as f:
        json.dump(result, f, indent=1)
        f.write("\n")
    print("traced %d regions, %d colours" % (len(regions), len(palette)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
