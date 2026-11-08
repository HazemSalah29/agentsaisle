---
description: Your 48 hour numbers into the ledger, then lessons into taste.md and a pick for what to make next.
argument-hint: "[idea note name or post link] (optional, default: every post waiting)"
---

# /video reel review

Reads how your posts did two days later, saves the numbers, and turns them into lessons.

Input: $ARGUMENTS (one post, optional). If empty, review every post that is waiting.

## 1. Find what is waiting

Read `00 - notes/ledger.md`. A post is waiting when its row in `## Posts` is at least 48 hours old and has no row in `## Stats at 48 h`. List them in one short table. A carousel counts the same as a reel. For a carousel, write `N/A` for skip rate and average watch, because it has no watch time. If none are waiting, say so, name the next one that will be ready, and stop.

## 2. Get the numbers

For each waiting post, get: views, skip rate, average watch time, shares, saves, comments.

- **With Zernio** (if the Zernio tools are connected): list the accounts, use the user's Instagram account, and read the post's numbers with the analytics tool. If more than one Instagram account is connected, ask which one.
- **Without Zernio:** ask the user for a screenshot of the post's Instagram Insights (open the reel or carousel, tap "View insights", take a screenshot, drop it here). Read the numbers from the picture. Read them back to the user in one line and ask "Right?" with buttons before saving.

If a number is not shown, leave it empty. Never guess one.

## 3. Save the numbers

For each post:

1. Add a row to `## Stats at 48 h` in the ledger: `| <idea note name> | views | skip rate | average watch | shares | saves | comments |`. Write average watch with the reel's length, for example `14 s of 30 s`. For a carousel, write `N/A` for skip rate and average watch.
2. In the idea note in `00 - notes/ideas/`, if there is one (the Stats id is its name; for a reel or carousel with no idea note, the id is its folder name and this step is skipped): set `views`, `shares` and `saves` to the same numbers. If `status` is not `posted` yet, set it to `posted`. If `post_url` is empty and you have the link, add it.
3. One line in `log.md`: `YYYY-MM-DD | 48 h numbers for <name> | 00 - notes/ledger.md, <idea note>`.

## 4. Lessons and the next pick

Read `<video-reel>/references/agent-coach.md` and do its job: the lessons in `taste.md` (30 at most, old ones merged), then the make-next pick.

End with the new lessons in plain words, and the pick.
