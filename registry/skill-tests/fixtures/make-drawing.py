"""Makes SYNTHETIC test pictures (no real child's art, no photo): a crayon-style stick creature on paper, and a
photo-like noisy picture with no paper. Usage: make-drawing.py drawing|photo out.png"""
import sys
import cv2
import numpy as np

kind, out = sys.argv[1], sys.argv[2]
if kind == "drawing":
    img = np.full((480, 360, 3), (225, 240, 245), np.uint8)  # warm paper (BGR)
    cv2.ellipse(img, (180, 300), (70, 90), 0, 0, 360, (40, 140, 240), -1)       # orange body
    cv2.circle(img, (180, 140), 60, (60, 210, 250), -1)                          # yellow head
    cv2.line(img, (110, 260), (50, 340), (200, 90, 40), 22)                      # blue arm
    cv2.line(img, (250, 260), (310, 340), (200, 90, 40), 22)                     # blue arm
    cv2.line(img, (150, 380), (140, 460), (90, 160, 60), 26)                     # green leg
    cv2.line(img, (210, 380), (220, 460), (90, 160, 60), 26)                     # green leg
else:
    rng = np.random.RandomState(1)
    base = rng.randint(0, 255, (48, 36, 3), np.uint8)
    img = cv2.resize(base, (360, 480), interpolation=cv2.INTER_CUBIC)
    img = cv2.GaussianBlur(img, (0, 0), 6)
cv2.imwrite(out, img)
