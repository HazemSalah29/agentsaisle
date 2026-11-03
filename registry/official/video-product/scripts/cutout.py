#!/usr/bin/env python3
"""Cut a product out of its photo and fill in the background behind it, for 2.5D parallax.

Usage: cutout.py <photo> <out-dir> [--alpha <cutout.png>]
Writes in <out-dir>: subject.png (the photo with transparency around the product), bg.jpg (the photo with the
product area filled in from its surroundings, so nothing shows through when the layers move apart),
preview.png (the cutout on a checkerboard, to look at) and cutout.json (how sure the cut is).
Without --alpha it uses OpenCV GrabCut, which works on any computer: it needs a product on a fairly plain
background, centred, and is weak on busy scenes (the result says so). With --alpha the transparency of your own
cutout PNG is used instead. It reads one photo and writes four files; no network, no other program.
Exit codes: 0 done (check "ok" in cutout.json), 2 bad usage or unreadable image, 3 OpenCV missing.
"""
import json
import os
import sys

MAX_SIDE = 2000   # outputs are at most this big on the long side
WORK_SIDE = 640   # GrabCut runs on a copy this big (it is slow on large pictures)


def fail(code, message):
    print(message, file=sys.stderr)
    return code


def main(argv):
    args = argv[1:]
    alpha_path = None
    if "--alpha" in args:
        i = args.index("--alpha")
        if i + 1 >= len(args):
            return fail(2, "--alpha needs a file")
        alpha_path = args[i + 1]
        del args[i:i + 2]
    if len(args) != 2:
        return fail(2, "Usage: cutout.py <photo> <out-dir> [--alpha <cutout.png>]")
    src, out_dir = args
    try:
        import cv2
        import numpy as np
    except ImportError:
        return fail(3, "OpenCV is not installed in this Python (opencv-python-headless). Run /video doctor.")
    img = cv2.imread(src, cv2.IMREAD_COLOR)
    if img is None:
        return fail(2, "The photo could not be read (PNG, JPEG or WebP).")
    h, w = img.shape[:2]
    if max(h, w) > MAX_SIDE:
        k = MAX_SIDE / float(max(h, w))
        img = cv2.resize(img, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]

    reasons = []
    if alpha_path:
        a = cv2.imread(alpha_path, cv2.IMREAD_UNCHANGED)
        if a is None or a.ndim != 3 or a.shape[2] != 4:
            return fail(2, "--alpha must be a PNG with a transparency channel.")
        mask = cv2.resize(a[:, :, 3], (w, h), interpolation=cv2.INTER_LINEAR)
        mask = (mask > 127).astype(np.uint8)
    else:
        k = min(1.0, WORK_SIDE / float(max(h, w)))
        small = cv2.resize(img, (max(1, int(w * k)), max(1, int(h * k))), interpolation=cv2.INTER_AREA)
        sh, sw = small.shape[:2]
        if float(small.std()) < 3.0:
            return fail(2, "The photo is almost a single flat colour; there is no product to cut out.")
        gc = np.full((sh, sw), cv2.GC_PR_BGD, np.uint8)
        # The border is background; a central ellipse is probably the product.
        m = max(2, int(min(sh, sw) * 0.04))
        gc[:m, :] = gc[-m:, :] = gc[:, :m] = gc[:, -m:] = cv2.GC_BGD
        cv2.ellipse(gc, (sw // 2, sh // 2), (int(sw * 0.32), int(sh * 0.34)), 0, 0, 360, cv2.GC_PR_FGD, -1)
        cv2.ellipse(gc, (sw // 2, sh // 2), (int(sw * 0.14), int(sh * 0.16)), 0, 0, 360, cv2.GC_FGD, -1)
        bgd = np.zeros((1, 65), np.float64)
        fgd = np.zeros((1, 65), np.float64)
        try:
            cv2.setRNGSeed(7)
            cv2.grabCut(small, gc, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
        except cv2.error as e:
            return fail(2, "GrabCut could not run on this photo: %s" % e)
        mask_small = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 1, 0).astype(np.uint8)
        mask = cv2.resize(mask_small, (w, h), interpolation=cv2.INTER_LINEAR)
        mask = (mask > 0).astype(np.uint8)

    # Keep the biggest piece, fill pinholes, smooth the edge.
    kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(3, w // 150) | 1,) * 2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kern)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kern)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if n > 1:
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        mask = (labels == big).astype(np.uint8)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(mask)
    cv2.drawContours(filled, cnts, -1, 1, thickness=cv2.FILLED)
    mask = filled

    area = float(mask.sum()) / float(h * w)
    touch = float((mask[0, :].sum() + mask[-1, :].sum() + mask[:, 0].sum() + mask[:, -1].sum())) / float(2 * (h + w))
    solidity = 1.0
    if cnts:
        c = max(cnts, key=cv2.contourArea)
        hull = cv2.contourArea(cv2.convexHull(c))
        solidity = float(cv2.contourArea(c)) / hull if hull > 0 else 1.0
    inside = mask.astype(bool)
    if inside.any() and (~inside).any():
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
        gap = float(np.linalg.norm(lab[inside].mean(axis=0) - lab[~inside].mean(axis=0)))
        if gap < 12.0:
            reasons.append("the product looks too much like its background (colour difference %.0f)" % gap)
    if area < 0.06:
        reasons.append("the cutout is tiny: the product may be too small or too similar to the background")
    if area > 0.85:
        reasons.append("the cutout is almost the whole photo: the background was not separated")
    if touch > 0.25:
        reasons.append("the cutout runs along the photo's edge: the product is cropped or the background is busy")
    if solidity < 0.55:
        reasons.append("the outline is ragged: the background is probably busy")
    ok = not reasons

    soft = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), max(1.0, w / 700.0))
    alpha = np.clip(soft * 255.0, 0, 255).astype(np.uint8)
    rgba = np.dstack([img, alpha])
    os.makedirs(out_dir, exist_ok=True)
    cv2.imwrite(os.path.join(out_dir, "subject.png"), rgba)

    # Background: paint the product area from what is around it (on a smaller copy, then blend back).
    grow = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(5, w // 60) | 1,) * 2))
    k2 = min(1.0, 900.0 / float(max(h, w)))
    s2 = cv2.resize(img, (max(1, int(w * k2)), max(1, int(h * k2))), interpolation=cv2.INTER_AREA)
    m2 = cv2.resize(grow, (s2.shape[1], s2.shape[0]), interpolation=cv2.INTER_NEAREST)
    filled_small = cv2.inpaint(s2, m2, 9, cv2.INPAINT_TELEA)
    filled_small = cv2.GaussianBlur(filled_small, (0, 0), 3)
    filled_big = cv2.resize(filled_small, (w, h), interpolation=cv2.INTER_CUBIC)
    blend = cv2.GaussianBlur(grow.astype(np.float32), (0, 0), max(2.0, w / 300.0))[:, :, None]
    bg = (img.astype(np.float32) * (1 - blend) + filled_big.astype(np.float32) * blend).astype(np.uint8)
    cv2.imwrite(os.path.join(out_dir, "bg.jpg"), bg, [cv2.IMWRITE_JPEG_QUALITY, 92])

    # Preview: the cutout on a checkerboard.
    tile = 24
    yy, xx = np.mgrid[0:h, 0:w]
    check = (((yy // tile) + (xx // tile)) % 2 * 40 + 200).astype(np.uint8)
    board = np.dstack([check, check, check]).astype(np.float32)
    a3 = (alpha.astype(np.float32) / 255.0)[:, :, None]
    prev = (img.astype(np.float32) * a3 + board * (1 - a3)).astype(np.uint8)
    cv2.imwrite(os.path.join(out_dir, "preview.png"), cv2.resize(prev, (max(1, w // 2), max(1, h // 2)), interpolation=cv2.INTER_AREA))

    # The product's main colour: the most common strongly coloured hue on the cutout (for brand accents).
    accent = None
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    sel = inside & (hsv[:, :, 1] > 90) & (hsv[:, :, 2] > 70)
    if sel.sum() > 200:
        hue = hsv[:, :, 0][sel].astype(np.int32) // 10
        top = int(np.bincount(hue, minlength=18).argmax())
        pix = img[sel][hue == top]
        if len(pix):
            b, g, r = [int(v) for v in pix.mean(axis=0)]
            accent = "#%02x%02x%02x" % (r, g, b)
    report = {
        "ok": ok,
        "accent": accent,
        "method": "alpha" if alpha_path else "grabcut",
        "width": w,
        "height": h,
        "foregroundShare": round(area, 3),
        "edgeContact": round(touch, 3),
        "solidity": round(solidity, 3),
        "reasons": reasons,
    }
    with open(os.path.join(out_dir, "cutout.json"), "w", encoding="utf8") as f:
        json.dump(report, f, indent=1)
        f.write("\n")
    print("cutout %s (%s): product covers %d%% of the photo%s" % ("ok" if ok else "LOW CONFIDENCE", report["method"], round(area * 100), "" if ok else "; " + "; ".join(reasons)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
