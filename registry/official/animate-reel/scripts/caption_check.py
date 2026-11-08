#!/usr/bin/env python3
"""
caption_check.py - lint a reel caption against our page rules and show what
the feed shows before "... more". Adapted from ig-caption's caption.py
(Jake Schincariol, MIT; see references/THIRD-PARTY.md); the checks are ours
(rules.md, Deliver and After the user posts). The hashtags and the keyword line
come from the page's brand.md (`hashtags:`, optional `caption_keyword:`); a field
left empty skips its check.

Checks
  Instagram / YouTube: line 1 is the comment ask, the ask is said once, the
  keyword line sits above the hashtags (when brand.md sets caption_keyword),
  exactly the brand.md hashtags (Instagram only, when set), no links, no em dash, no invisible characters, 2,200
  characters at most, and "An original parable." with --parable.
  Threads: the ask anywhere but said once, at most one topic tag.

Usage
  python3 caption_check.py caption.txt
  python3 caption_check.py caption.txt --platform youtube
  python3 caption_check.py caption.txt --parable
  python3 caption_check.py caption.txt --brand "00 - notes/context/declared/brand.md"
"""

import argparse
import re
import sys
import textwrap

LIMIT = 2200
TRUNCATE = 125
BRAND = "00 - notes/context/declared/brand.md"
HASHTAG_RE = re.compile(r"(?:^|\s)(#[\w]+)")
LINK_RE = re.compile(r"https?://\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|co|io|net|org|ai|app)/\S*", re.I)
ASK_RE = re.compile(r"\bcomment\s+[\"“']?([A-Za-z'’-]+)", re.I)
OTHER_ASKS = re.compile(r"\b(?:save this|share this|send this to|tag (?:someone|a friend)|follow for more|link in bio|double tap)\b", re.I)
INVISIBLE = re.compile("[​-‏⁠-⁤﻿­\U000e0000-\U000e007f]")


def load_brand(path):
    """hashtags (list, lower case) and caption_keyword (lower case) from brand.md front matter; empty when unset."""
    try:
        s = open(path, encoding="utf-8").read()
    except OSError:
        return [], ""
    m = re.match(r"---\n(.*?)\n---", s, re.S)
    front = m.group(1) if m else ""
    def field(name):
        f = re.search(rf"^{name}:[ \t]*(.*?)$((?:\n[ \t]+-.*)*)", front, re.M)
        if not f:
            return ""
        return (re.sub(r"\s#\s.*$|^#\s.*$", "", f.group(1)).strip() + f.group(2)).strip()
    tags = [t.lower() for t in re.findall(r"#\w+", field("hashtags"))]
    kw = field("caption_keyword").strip("\"' ").lower()
    return tags, kw


def check(text, platform, parable, hashtags=(), keyword=""):
    out = []
    add = lambda level, msg: out.append((level, msg))
    lines = [l.rstrip() for l in text.strip().splitlines()]
    first = lines[0] if lines else ""
    asks = ASK_RE.findall(text)

    if len(text) > LIMIT:
        add("FAIL", f"{len(text)} characters, over Instagram's {LIMIT}.")
    if "\u2014" in text:
        add("FAIL", "Em dash found. Rewrite the sentence (rules.md, Copy).")
    if INVISIBLE.search(text):
        add("FAIL", "Invisible characters found. Retype the caption or strip them.")
    if LINK_RE.search(text):
        add("FAIL", "Link in the caption. Captions are not clickable: bio or DM.")
    if not asks:
        add("FAIL", "No comment ask. Every reel ends with one (rules.md, Copy).")
    elif len(asks) > 1:
        add("FAIL", f"The comment ask is said {len(asks)} times ({', '.join(asks)}). Say it once.")
    if OTHER_ASKS.search(text):
        add("WARN", f"A second ask (\"{OTHER_ASKS.search(text).group(0)}\"). One ask per caption.")
    if re.search(r"\bfollow\b[^.\n]{0,30}\band comment\b", first, re.I):
        add("WARN", "Line 1 asks for a follow and a comment. That is a gate on the ask; keep it only if chosen.")
    if parable and "an original parable" not in text.lower():
        add("FAIL", "Parable caption without \"An original parable.\" (rules.md, Deliver).")

    tags = [t.lower() for t in HASHTAG_RE.findall(text)]
    if platform == "threads":
        if len(tags) > 1:
            add("FAIL", f"{len(tags)} tags. Threads takes one topic tag, on the opening post only.")
        return out

    if not ASK_RE.search(first):
        add("FAIL", "Line 1 is not the comment ask. Instagram hides the rest behind \"more\".")
    if len(first) > TRUNCATE:
        add("WARN", f"Line 1 is {len(first)} characters; the feed shows about {TRUNCATE}.")
    body = [l for l in lines if l.strip()]
    tag_line = next((i for i, l in enumerate(body) if l.lstrip().startswith("#")), None)
    keyword_line = body[tag_line - 1] if tag_line else (body[-1] if body else "")
    if keyword and not keyword_line.lower().startswith(keyword):
        add("FAIL", f"No keyword line starting \"{keyword}\" above the hashtags (brand.md, caption_keyword).")
    if platform == "instagram":
        if hashtags and tags != list(hashtags):
            add("FAIL", f"Hashtags are {' '.join(tags) or 'missing'}; use exactly {' '.join(hashtags)} (brand.md, hashtags).")
        elif tag_line is not None and tag_line != len(body) - 1:
            add("WARN", "Hashtags are not on the last line.")
    return out


def main():
    ap = argparse.ArgumentParser(description="Lint a reel caption against the page rules.")
    ap.add_argument("input", nargs="?", default="-")
    ap.add_argument("--platform", choices=["instagram", "youtube", "threads"], default="instagram")
    ap.add_argument("--parable", action="store_true", help="the reel is an original parable")
    ap.add_argument("--brand", default=BRAND, help="the page's brand.md (hashtags, caption_keyword)")
    args = ap.parse_args()
    text = sys.stdin.read() if args.input == "-" else open(args.input, encoding="utf-8").read()

    flat = " ".join(text.split())
    print(f"\nWHAT THE FEED SHOWS ({args.platform})\n+" + "-" * 66 + "+")
    for row in textwrap.wrap(flat[:TRUNCATE] + (" ... more" if len(flat) > TRUNCATE else ""), 64):
        print(f"| {row:<64} |")
    print("+" + "-" * 66 + "+")

    hashtags, keyword = load_brand(args.brand)
    results = check(text, args.platform, args.parable, hashtags, keyword)
    for level, msg in results:
        print(f"  {level}  {msg}")
    fails = sum(1 for l, _ in results if l == "FAIL")
    print(f"\n  {'READY' if not fails else f'NOT READY: {fails} FAIL'}"
          f"{'' if not results else f', {len(results) - fails} WARN to decide out loud'}\n")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
