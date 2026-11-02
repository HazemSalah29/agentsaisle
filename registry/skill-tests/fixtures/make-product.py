"""Makes a SYNTHETIC product photo for tests: a shaded bottle shape on a plain studio background.
Usage: make-product.py plain|busy out.jpg"""
import sys
import cv2
import numpy as np

kind, out = sys.argv[1], sys.argv[2]
h, w = 900, 700
yy, xx = np.mgrid[0:h, 0:w]
if kind == "plain":
    base = (235 - 25 * (yy / h)).astype(np.uint8)
    img = np.dstack([base, base - 4, base - 10])
    cx = w // 2
    cv2.rectangle(img, (cx - 110, 300), (cx + 110, 780), (40, 60, 190), -1)             # body
    cv2.rectangle(img, (cx - 40, 180), (cx + 40, 300), (45, 70, 200), -1)               # neck
    cv2.rectangle(img, (cx - 48, 150), (cx + 48, 190), (30, 30, 30), -1)                # cap
    cv2.rectangle(img, (cx - 70, 380), (cx + 70, 620), (240, 240, 240), -1)             # label
    cv2.line(img, (cx - 90, 320), (cx - 90, 760), (120, 130, 235), 14)                  # highlight
    img = cv2.GaussianBlur(img, (0, 0), 1.2)
else:
    rng = np.random.RandomState(3)
    img = cv2.resize(rng.randint(0, 255, (45, 35, 3), np.uint8), (w, h), interpolation=cv2.INTER_CUBIC)
    cv2.rectangle(img, (240, 300), (460, 780), (40, 60, 190), -1)
cv2.imwrite(out, img, [cv2.IMWRITE_JPEG_QUALITY, 92])
