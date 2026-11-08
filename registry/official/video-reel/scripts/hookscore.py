#!/usr/bin/env python3
"""
hookscore.py - score the first line of a reel on five things strong hooks
share, and rank a batch of them. Adapted for a deen page from ig-reel's
hookscore.py (Jake Schincariol, MIT; see references/THIRD-PARTY.md).

What changed for us: harsh business "stakes" words are out, gentle tension
words and Islamic names and terms count as concrete, guilt, scare and riddle
hooks are dealbreakers, and absolute words ("only", "never", "every") are
flagged to be checked against the primary text, because the hook is the
highest-risk line (rules.md, Source).

What this is NOT: a view predictor. The original tested well at telling a
real hook from a bad one, and barely better than a coin flip at telling a
good hook from a slightly better one. Use it to catch greetings, preambles,
vague lines and slow lines. The story, the picture and the source decide the
rest.

Usage
  python3 hookscore.py hooks.txt              # one hook per line, ranked
  python3 hookscore.py --hook "Seventy companions were killed at Uhud."
  python3 hookscore.py hooks.txt --json
"""

import argparse
import json
import re
import statistics
import sys

WORD_RE = re.compile(r"[A-Za-z0-9$%'’-]+")
NUMBER_RE = re.compile(r"\b\d[\d,]*(?:\.\d+)?\s?(?:%|x\b)?")
PROPER_RE = re.compile(r"(?<!^)\b[A-Z][a-z]{2,}\b")
HASHTAG_RE = re.compile(r"(?:^|\s)#\w+")
EMOJI_RE = re.compile(r"[\U0001F300-\U0001FAFF☀-➿]")

SPOKEN_NUMBERS = {
    "zero", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "fifteen", "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "million",
    "dozen", "half", "twice",
}
# Islamic names and terms are as concrete as a number: the viewer can picture
# them and the source can be checked.
DEEN_TERMS = {
    "allah", "quran", "qur'an", "salah", "fajr", "dhuhr", "asr", "maghrib",
    "isha", "jumu'ah", "jummah", "wudu", "du'a", "dua", "dhikr", "sujood",
    "ruku", "jannah", "surah", "ayah", "hadith", "ramadan", "kaaba", "makkah",
    "madinah", "uhud", "badr", "subhanallah", "alhamdulillah", "tahajjud",
    "sahabi", "companion", "companions", "prophet", "angel", "jibril",
}
# Gentle tension: a turn, a cost, a weight. No fear and no blame.
STAKES = {
    "but", "until", "before", "after", "only", "never", "still", "even",
    "nothing", "nobody", "no", "not", "don't", "dont", "didn't", "can't",
    "won't", "lost", "left", "alone", "afraid", "tired", "heavy", "broke",
    "broken", "forgive", "forgiven", "forgot", "mistake", "wrong", "last",
    "first", "again", "instead", "without", "except", "unless", "already",
    "secret", "hidden", "truth", "changed", "turned", "split", "killed",
    "died", "cried", "wept", "ran", "stayed", "returned", "allowed",
    "fought", "fight", "battle", "war", "charge", "enemy", "against",
}
WEAK_OPENERS = [
    "so", "ok", "okay", "hey", "hi", "hello", "guys", "yo", "alright",
    "assalamu", "salam", "welcome", "today", "basically", "honestly", "um",
    "just", "let", "lets", "let's", "i wanted", "i want", "one of",
    "in this", "in today", "the thing", "a lot", "as a", "you know",
]
IMPERATIVES = {"watch", "pause", "say", "read", "save", "try", "listen", "look", "imagine"}
ABSOLUTES = {"only", "never", "every", "always", "all", "none", "once", "first", "most", "nobody"}

DEALBREAKERS = [
    (re.compile(r"(?i)^\s*(?:stop scrolling|don'?t scroll)"),
     "Opens with \"stop scrolling\". Asking for attention shows the line has not earned it."),
    (re.compile(r"(?i)\b(?:in (?:this|today'?s) (?:video|reel)|i'?m going to show you|i'?ll show you how)\b"),
     "Video preamble. Delete it and open on the payoff."),
    (re.compile(r"(?i)^\s*(?:hey |hi |what'?s up |welcome )"),
     "Greeting. Open on the story, not on hello."),
    (re.compile(r"(?i)\byou (?:didn'?t|did not|never|don'?t even) (?:pray|get up|read|wake|care|try)\b"
                r"|\bshame on\b|\bashamed\b|\byou should be\b|\bhow dare\b"),
     "Guilt hook. Name a struggle gently, never sting the viewer (rules.md, Copy)."),
    (re.compile(r"(?i)\bbefore it'?s too late\b|\byou will burn\b|\bwarning\b|\bthis will scare you\b"),
     "Scare hook. Calm, never fear."),
    (re.compile(r"(?i)^\s*(?:guess|can you guess)\b|^\s*(?:who|what) (?:held|is|was|am i)\b[^?]{0,40}\?$"),
     "Riddle hook. Name the thing; hold back only the turn."),
    (HASHTAG_RE, "Hashtag in the hook. Hashtags go at the bottom of the caption."),
    (EMOJI_RE, "Emoji in the hook. At hook size there is room for words or an emoji, not both."),
]


def clamp(n):
    return max(0.0, min(100.0, n))


def words(text):
    return WORD_RE.findall(re.sub(r"(?<=\d),(?=\d)", "", text))


def low_words(text):
    return [w.lower().strip("'’") for w in words(text)]


def check_length(text):
    """It must land in about 2 s, before the thumb moves."""
    n = len(words(text))
    chars = len(text.strip())
    if 5 <= n <= 12:
        score = 100.0
    elif n < 5:
        score = clamp(100 - (5 - n) * 20)
    else:
        score = clamp(100 - (n - 12) * 11)
    if chars > 60:
        score -= 12
    return clamp(score), f"{n} words, {chars} chars, ~{n / 2.75:.1f}s spoken (want 5-12 words)"


def check_specificity(text):
    """A number, a name or a deen term the viewer can picture."""
    nums = [n.strip() for n in NUMBER_RE.findall(text) if n.strip()]
    propers = set(PROPER_RE.findall(text))
    low = low_words(text)
    terms = [w for w in low if w in SPOKEN_NUMBERS or w in DEEN_TERMS]
    terms = [w for w in terms if w.capitalize() not in propers]
    hits = len(nums) + len(propers) + len(terms)
    score = 15.0 if hits == 0 else clamp(45 + hits * 30)
    found = ", ".join(nums[:2] + sorted(propers)[:2] + terms[:2])
    return score, (f"{hits} concrete marker(s)" + (f": {found}" if found else
                   " - no number, no name, nothing the viewer can picture"))


def check_stakes(text):
    """A turn, a weight, something that changed."""
    markers = sorted({w for w in low_words(text) if w in STAKES})
    n = len(markers)
    score = {0: 20.0, 1: 70.0}.get(n, 100.0)
    return score, f"{n} tension marker(s)" + (f": {', '.join(markers[:4])}" if markers else
                                            " - nothing turns or weighs in this line")


def check_frontload(text):
    """The interesting word comes early, not at word nine."""
    w = words(text)
    if not w:
        return 0.0, "empty"
    low = [x.lower().strip("'’") for x in w]
    opener = " ".join(low[:2])
    penalty, hit = 0, None
    for weak in WEAK_OPENERS:
        if opener.startswith(weak) or low[0] == weak:
            penalty, hit = 30, weak
            break
    payload = None
    for i, t in enumerate(low):
        if (t in STAKES or t in SPOKEN_NUMBERS or t in DEEN_TERMS
                or NUMBER_RE.match(w[i]) or (i and PROPER_RE.match(w[i]))):
            payload = i
            break
    if payload is None:
        base, where = 30.0, "no payload word anywhere in the line"
    elif payload <= 3:
        base, where = 100.0, f"payload at word {payload + 1}"
    elif payload <= 6:
        base, where = 70.0, f"payload at word {payload + 1}, could move forward"
    else:
        base, where = 40.0, f"payload at word {payload + 1}, too late"
    return clamp(base - penalty), where + (f"; weak opener \"{hit}\"" if hit else "")


def check_address(text):
    """Aimed at one viewer, or told as a story they walk into."""
    low = text.lower()
    w = low_words(text)
    if re.search(r"\b(you|your|you're|youre|yourself)\b", low):
        return 100.0, "speaks to the viewer"
    if w and w[0] in IMPERATIVES:
        return 90.0, f"imperative opener (\"{w[0]}\")"
    if re.search(r"\b(?:there was|man|woman|men|women|companions?|people|he|she|they|his|her)\b", low):
        return 75.0, "a story the viewer walks into"
    if re.search(r"\b(i|my|me|we|our|us)\b", low):
        return 70.0, "first person, no viewer named"
    return 40.0, "nobody in the room"


CHECKS = ["LENGTH", "SPECIFICITY", "STAKES", "FRONTLOAD", "ADDRESS"]


def run(text):
    results = {
        "LENGTH": check_length(text),
        "SPECIFICITY": check_specificity(text),
        "STAKES": check_stakes(text),
        "FRONTLOAD": check_frontload(text),
        "ADDRESS": check_address(text),
    }
    flags = [msg for pat, msg in DEALBREAKERS if pat.search(text)]
    checks = sorted({w for w in low_words(text) if w in ABSOLUTES})
    scores = [results[c][0] for c in CHECKS]
    # The weakest property caps the hook: one bad property is enough to lose the viewer.
    overall = clamp(statistics.mean(scores) * 0.6 + min(scores) * 0.4 - len(flags) * 15)
    # Any dealbreaker (guilt, scare, riddle, preamble) takes the hook out, whatever it scores.
    verdict = "OUT" if flags else "STRONG" if overall >= 70 and min(scores) >= 55 else (
        "OK" if overall >= 50 else "WEAK")
    return results, overall, verdict, flags, checks


def bar(score, width=24):
    filled = round(score / 100 * width)
    return "#" * filled + "." * (width - filled)


def render_one(text, results, overall, verdict, flags, checks):
    print("\nHOOK SCORE\n" + "=" * 62)
    print(f"  \"{text.strip()}\"\n")
    for name in CHECKS:
        score, detail = results[name]
        print(f"  {name:<13} {bar(score)} {score:5.1f}")
        print(f"  {'':<13} {detail}")
    print("-" * 62)
    print(f"  {'HOOK SCORE':<13} {bar(overall)} {overall:5.1f}   {verdict}")
    for f in flags:
        print(f"\n  DEALBREAKER  {f}")
    if checks:
        print(f"\n  CHECK SOURCE  absolute word(s): {', '.join(checks)}. Confirm on the primary page.")
    if verdict != "STRONG":
        weakest = min(CHECKS, key=lambda c: results[c][0])
        print(f"\n  Weakest property: {weakest}. Fix that one and re-run.")
    print()


def render_table(rows):
    print("\nHOOK RANKING\n" + "=" * 78)
    for i, r in enumerate(rows, 1):
        mark = "->" if i == 1 else "  "
        hook = r["hook"] if len(r["hook"]) <= 62 else r["hook"][:59] + "..."
        print(f"{mark} {r['score']:5.1f} {r['verdict']:<7} {hook}")
        print(f"        weakest: {r['weakest']} ({r['checks'][r['weakest']]['score']:.0f})")
        for f in r["flags"]:
            print(f"        dealbreaker: {f}")
        if r["check_source"]:
            print(f"        check source: {', '.join(r['check_source'])}")
    print("\nA score under 50 means the hook is not there yet. The score never beats the source or the story.\n")


def main():
    ap = argparse.ArgumentParser(description="Score a reel hook on five properties.")
    ap.add_argument("input", nargs="?", default="-", help="file with one hook per line, or -")
    ap.add_argument("--hook", help="score a single hook")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    if args.hook:
        lines = [args.hook]
    else:
        raw = sys.stdin.read() if args.input == "-" else open(args.input, encoding="utf-8").read()
        lines = [l.strip() for l in raw.splitlines() if l.strip()]
    if not lines:
        print("nothing to score", file=sys.stderr)
        sys.exit(2)

    payload = []
    for line in lines:
        results, overall, verdict, flags, checks = run(line)
        payload.append({
            "hook": line,
            "checks": {k: {"score": round(v[0], 1), "detail": v[1]} for k, v in results.items()},
            "weakest": min(CHECKS, key=lambda c: results[c][0]),
            "flags": flags,
            "check_source": checks,
            "score": round(overall, 1),
            "verdict": verdict,
        })

    if args.json:
        print(json.dumps(payload if len(payload) > 1 else payload[0], indent=2, ensure_ascii=False))
    elif len(payload) == 1:
        render_one(lines[0], *run(lines[0]))
    else:
        render_table(sorted(payload, key=lambda r: (r["verdict"] == "OUT", -r["score"])))


if __name__ == "__main__":
    main()
