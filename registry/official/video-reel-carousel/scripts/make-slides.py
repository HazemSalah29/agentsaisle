# usage: python3 -I make-slides.py <deck-folder>
# Reads <deck-folder>/deck.json. For plain and themed looks, writes slides/NN.html from assets/<look>.html
# (../assets/ in the desktop skill, ../../assets/carousel/ in the chat engine).
# For the graphic look, writes nothing and checks that slides/NN.html exists for every slide.
import html, json, re, sys
from pathlib import Path

SIZES = {"3:4": (1080, 1440), "4:5": (1080, 1350), "1:1": (1080, 1080)}
LOOKS = ("plain", "themed", "graphic")
AR = "؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿"
AR_RUN = re.compile(r"[%s]+(?:[\s،؛؟.,:;!?()\"'“”«»\-]*[%s]+)*" % (AR, AR))
HEX = re.compile(r"^#[0-9a-fA-F]{3,8}$")
FONT = re.compile(r"^[\w \-]{1,60}$")


FONT_FILE = "ScheherazadeNew-Regular.ttf"


def find_font(here):
    """Scheherazade New: next to the kit's engine assets (desktop, chat), or the repo's video-reel assets (tests)."""
    cands = [here / "../../video-reel/assets", here / "../../assets"]
    cands += [p / "<video-reel>/assets" for p in here.parents]
    cands += [p / "video-reel/assets" for p in here.parents]
    for c in cands:
        f = (c / FONT_FILE).resolve()
        if f.is_file():
            return f
    return None


def find_template(here, look):
    """The page template: ../assets/ in the desktop skill, ../../assets/carousel/ in the chat engine."""
    for c in (here / "../assets", here / "../../assets/carousel"):
        f = (c / ("%s.html" % look)).resolve()
        if f.is_file():
            return f
    fail("%s.html not found in ../assets/ or ../../assets/carousel/ next to make-slides.py" % look)


def fail(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def line_html(line):
    """One text line as a block. An all-Arabic line is its own rtl block; Arabic inside English gets an rtl span."""
    line = line.strip()
    if not line:
        return ""
    runs = list(AR_RUN.finditer(line))
    if runs and not re.sub(r"[\W\d_]", "", AR_RUN.sub("", line)):
        return '<p class="ar" dir="rtl" lang="ar">%s</p>' % html.escape(line)
    out, pos = [], 0
    for m in runs:
        out.append(html.escape(line[pos:m.start()]))
        out.append('<span dir="rtl" lang="ar">%s</span>' % html.escape(m.group()))
        pos = m.end()
    out.append(html.escape(line[pos:]))
    return "<p>%s</p>" % "".join(out)


def text_html(text):
    return "\n".join(x for x in map(line_html, str(text).split("\n")) if x)


def main():
    if len(sys.argv) != 2:
        fail("usage: python3 -I make-slides.py <deck-folder>")
    folder = Path(sys.argv[1]).resolve()
    try:
        deck = json.loads((folder / "deck.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        fail("cannot read deck.json: %s" % e)
    look = deck.get("look", "plain")
    size = deck.get("size", "3:4")
    if look not in LOOKS:
        fail("unknown look %r (use plain, themed or graphic)" % look)
    if size not in SIZES:
        fail("unknown size %r (use 3:4, 4:5 or 1:1)" % size)
    slides = deck.get("slides") or []
    if not slides:
        fail("deck.json has no slides")
    out = folder / "slides"
    if look == "graphic":
        if size != "3:4":
            print("note: graphic-base.html is drawn at 3:4; each page must set its own size for %s" % size)
        for i in range(1, len(slides) + 1):
            if not (out / ("%02d.html" % i)).is_file():
                fail("missing slides/%02d.html" % i)
        print("graphic deck: %d slides found" % len(slides))
        return
    w, h = SIZES[size]
    colors = {}
    for key, default in (("bg", "#fbf7ef"), ("ink", "#1d1b18"), ("accent", "#c2410c")):
        v = deck.get(key, default)
        if not HEX.match(str(v)):
            fail("%s must be a hex colour, got %r" % (key, v))
        colors[key] = v
    fonts = {}
    for key in ("font_head", "font_body"):
        v = deck.get(key) or "Helvetica Neue"
        if not FONT.match(str(v)):
            fail("%s has odd characters: %r" % (key, v))
        fonts[key] = '"%s"' % v
    tpl = find_template(Path(__file__).resolve().parent, look).read_text(encoding="utf-8")
    out.mkdir(exist_ok=True)
    for old in out.glob("*.html"):
        if re.fullmatch(r"\d+", old.stem) and int(old.stem) > len(slides):
            old.unlink()
    font = find_font(Path(__file__).resolve().parent)
    if font:
        face = '@font-face{font-family:"Scheherazade New";src:url("%s")}' % font.as_uri()
    else:
        face = ""
        print("warning: %s not found; Arabic will use a system font" % FONT_FILE, file=sys.stderr)
    n = len(slides)
    for i, s in enumerate(slides, 1):
        lead = (s.get("lead") or "").strip() if look == "themed" else ""
        src = (s.get("source") or "").strip() if look == "themed" else ""
        vals = {
            "W": w, "H": h, "BG": colors["bg"], "INK": colors["ink"], "ACCENT": colors["accent"],
            "FONT_HEAD": fonts["font_head"], "FONT_BODY": fonts["font_body"],
            "PCT": round(i * 100 / n, 2), "BAR": "block" if deck.get("progress") else "none",
            "LEAD": '<div class="lead">%s</div>' % html.escape(lead) if lead else "",
            "SOURCE": '<div class="source">%s</div>' % html.escape(src) if src else "",
            "HANDLE": html.escape(str(deck.get("handle", ""))), "NUM": "%d / %d" % (i, n),
            "FONTFACE": face, "TEXT": text_html(s.get("text", "")),
        }
        page = re.sub(r"\{\{(\w+)\}\}", lambda m: str(vals[m.group(1)]), tpl)
        (out / ("%02d.html" % i)).write_text(page, encoding="utf-8")
    print("wrote %d slides to %s" % (n, out))


main()
