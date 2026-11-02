# Writing copy.json

`publish/copy.json`: `{ "title": "...", "description": "...", "hashtags": ["#ratelimit", "#api"] }`. One file serves every platform in the run; the script checks it against each platform's rules and adds YouTube chapters itself.

## Rules the script enforces

- Title: required where the platform has titles (YouTube, Shorts: at most 100 characters). Reels, TikTok and LinkedIn have no separate title.
- Description: required; YouTube counts bytes (5,000), the others characters (Reels and TikTok 2,200, LinkedIn 3,000). YouTube forbids `<` and `>`.
- Hashtags: `#` then letters, digits or `_`, no repeats, within the platform's count.
- No leftover `TODO`, `TBD`, `[needs-source]`, `???`.
- **Every number in the title and description must appear in `script.md` or `facts.md`.** Never add a figure, a percentage, a ranking or a "best". If a number is not in the facts, leave it out.

## Writing it

- Open with the promise from `brief.json`, in plain words. No "you won't believe". Say what the viewer will see.
- Do not claim results, benefits or comparisons that the facts do not support. A simulation result is "in this simulation".
- Say the voice is computer-generated if it is, once, in the description (the disclosure note also says so).
- Hashtags: 3 to 5 topic words, not trending tags. For Arabic, write the title and description in Arabic natively.
- Chapters (YouTube only) are made from the scenes: first at 0:00, each at least 10 s, at least three, otherwise none. Do not write timestamps by hand.
