# Personalised videos from a CSV

Fills a template project's `video.json` and `script.md` once per CSV row and writes `row-001`, `row-002` and so on. Values replace text only, so a cell can never change the structure. `<skill>` is the folder that holds this SKILL.md; `<video-core>` is the sibling `video-core` skill.

## Use when

- The user wants the same video for many people or accounts, with their own list.
- A finished or draft template project exists, with placeholders such as `{{name}}` in its text.

## Don't use when

- The data is not the user's own, or was scraped or bought. Refuse.
- The user wants real people's faces, voices or likeness. Not built.
- The user wants only the script, voice or render: `video-write`, `video-voice`, `video-core`.

## Steps

1. Ask the user to confirm the list is their own data and that the videos stay on this machine. Do not open the CSV yourself; the script reads it.
2. Put `{{column}}` placeholders in the template's `video.json` text and `script.md` (`references/batch.md`). Column names are lowercase letters, digits and `_`.
3. Dry run: `node <skill>/scripts/batch.mjs --template projects/<t> --csv <file> --out projects/<t>-batch`. Check the counts it prints.
4. Write: the same command with `--apply`. Then voice, timing, captions, `<video-core>/scripts/check.mjs` and render per row.
5. When done, remove the personal data: `node <skill>/scripts/batch.mjs --clean projects/<t>-batch`.

## Budget

- Do not print or paste CSV rows, in the chat or in notes.

## Output

- Row count, placeholders used, unused columns, and the output folder. No cell values.

## Done when

- Every row has its own project, `check.mjs` passes on a sample, and the user knows how to clean up.
- Nothing was sent anywhere and the CSV was not copied.

## Details

- Placeholders look like `{{name}}` and work in strings of `video.json` and in `script.md`. A cell is plain text: markup stays text, control and bidi characters become spaces, 80 characters at most.
- Limits: 200 rows, 20 columns, 1 MB. Quoted cells, doubled quotes and commas or newlines inside quotes work.
- Refused: a placeholder with no column, an empty value in a used column, duplicate or oddly named columns, a template with no placeholders, a non-empty output folder.
- Copied from the template: assets and brand files. Not copied: `voice/`, `exports/`, `qa/`, rendered media, the CSV.
- Privacy: local only, no network. Output names are `row-NNN`, never taken from the data. `--clean` removes only a folder that holds the `.aisle-batch` marker.
- Names in a spoken script can sound wrong in a voice model; listen to a sample before rendering all rows.
