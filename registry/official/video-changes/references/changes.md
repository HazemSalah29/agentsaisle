# Changes details

- Counts come from the diff: files, lines added, lines removed per file. Never round or estimate them.
- A code scene needs a hunk of at most 20 lines, 60 characters wide, in a language the code scene knows (js, ts, json, sh, py). Other files appear only in the totals.
- The changelog section is found by a heading that contains the release text; its bullets (at most five) are shown as written, markdown marks removed.
- Not built: architecture diff (needs two arch-visualize models), code morph between hunks, binary files.
