---
name: video-ingest
description: Bring footage into a video project with a recorded rights basis, from an https URL (through yt-dlp) or a local file, and keep a rights ledger. Use when the user wants to download their own upload, Creative Commons or public-domain footage, or a reference copy for analysis, or runs /video-ingest. Don't use for paid, DRM-protected or login-only services, footage the user has no right to use, or when no rights basis is given.
disable-model-invocation: true
allowed-tools: Read Write Glob Grep Bash(node *)
---

# Video ingest

Downloads or copies footage into `<project>/ingest/`, records why the user may use it in `rights-ledger.json`, and lists it in `video.json` with a licence. Together with `video-generate` it is one of two video skills that use the network, and it does so only through `yt-dlp`, which the user installs. `<skill>` below is the folder that holds this SKILL.md.

## Use when

- The user wants their own upload, CC-licensed or public-domain footage, or footage someone gave them permission to use.
- `video-analyze` needs a reference copy to measure (use `--analysis-only`).

## Don't use when

- There is no rights basis. Never suggest one for them; ask which of `own`, `permission`, `cc`, `public-domain` is true, and stop on "none" or "not sure".
- The source is a paid, DRM-protected or login-only service (the script refuses the known ones; refuse the rest by judgement).
- The footage would be shown in a video but the user only has it for analysis: `--analysis-only` copies are blocked from scenes by `check.mjs`.

## Steps

1. Ask for the URL (or file), the rights basis and, for `permission`, `cc` and `public-domain`, a note of 15+ characters: the licence name and link, or who agreed.
2. Run `node <skill>/scripts/ingest.mjs <project> <url> --rights <basis> --source-note "..." [--id clip-name] [--analysis-only]`, or `--file <path>` for a local file.
3. If yt-dlp is missing the script says so; show `references/rights.md` for the install line and do not install it for the user.
4. Run `node <skill>/scripts/ingest.mjs <project> --verify` to check that every ledger file still matches its hash.
5. Credits and the licence text come from `video-core`'s `credits.mjs`; attribution for `cc` is the note.

## Budget

<!-- include: _shared/read-budget.md -->

- One download per call. Never open, play or run the downloaded file; the ledger has its size and hash.

## Output

- Asset id, path, size, rights basis, and whether it is analysis-only.
- A reminder that the rights basis is the user's statement, recorded but not checked.

## Done when

- `ingest.mjs` exited 0, `rights-ledger.json` has the entry and `video.json` lists the asset with a licence (or the user was told there was no `video.json`).
- A refusal printed its reason and nothing was written.
