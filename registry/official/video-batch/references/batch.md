# Batch details

- Placeholders look like `{{name}}` and work in strings of `video.json` and in `script.md`. A cell is plain text: markup stays text, control and bidi characters become spaces, 80 characters at most.
- Limits: 200 rows, 20 columns, 1 MB. Quoted cells, doubled quotes and commas or newlines inside quotes work.
- Refused: a placeholder with no column, an empty value in a used column, duplicate or oddly named columns, a template with no placeholders, a non-empty output folder.
- Copied from the template: assets and brand files. Not copied: `voice/`, `exports/`, `qa/`, rendered media, the CSV.
- Privacy: local only, no network. Output names are `row-NNN`, never taken from the data. `--clean` removes only a folder that holds the `.aisle-batch` marker.
- Names in a spoken script can sound wrong in a voice model; listen to a sample before rendering all rows.
