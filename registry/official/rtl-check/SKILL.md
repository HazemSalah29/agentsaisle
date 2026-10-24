---
name: rtl-check
description: After editing UI code in a project that supports right-to-left languages (it has i18n.config.json with an Arabic locale), check the changed files for RTL problems such as physical Tailwind classes, hardcoded dir="ltr", unflipped directional icons and locale-less number or date formatting. Read-only. Use when you have just written or changed React, Next.js or CSS files in such a project. Don't use in projects without RTL support.
model: haiku
effort: low
allowed-tools: Read Grep Glob Bash(node *) Bash(git diff *) Bash(git status *)
---

# RTL check

## Use when

- You changed UI files (`.tsx`, `.jsx`, `.css`) in a project with `i18n.config.json` listing an Arabic locale.

## Don't use when

- The project has no `i18n.config.json`, or no Arabic locale in it.
- The task is a full Arabic conversion. That is `/arabic-rtl`.

## Steps

1. Get the changed files: `git diff --name-only` plus `git status --short` for new files. Keep only source and style files.
2. Run `node <skill>/scripts/rtl-scan.mjs <file> <file> ...` with those paths. Add `--errors-only` for a quiet pass.
3. Fix each `error` in the code you just wrote, using the suggestion in the output. Logical classes: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `rounded-s-*`.
4. For `warn`s in your own new code, fix the clear ones (explicit locale for `Intl`, `DirectionalIcon` for arrows). Mention the rest in one line.
5. Do not edit files you did not change. Do not run a codemod; suggest `/arabic-rtl` if many old files fail.

## Budget

- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.

- One scan call for all changed files; do not read the files again unless a finding needs context.

## Output

- One line: `RTL check: N error(s), M warning(s)` and the fixes made. Nothing if the scan is clean and the project has no Arabic locale.

## Done when

- The scan of the changed files reports 0 errors.
