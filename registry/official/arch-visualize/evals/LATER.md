# Later (not in 0.2.0): design notes only

Nothing here is built. It is written down so the next version does not start from nothing.

- **Click-to-source.** `render.mjs --source-links vscode --abs-root <folder>` would turn each evidence file and line in the panel into an `vscode://file/<abs>:<line>` link. Off by default, because it writes an absolute path of the author's machine into a page that may be shared; the flag would print that warning. Not built.
- **`--title`.** A flag to override the project name in the header and the document title. Small; not built.
- **WebM of a flow.** Recording a flow with `MediaRecorder` on a canvas copy. Browser support differs and cannot be tested offline here, so it was left out rather than shipped untested.
- **Python, Go, Java discovery.** The patterns in `edges.mjs` are JavaScript and TypeScript only. Each language needs its own import and constructor patterns and its own fixture before any recall number is quoted.
- **Native review of the Arabic text**, then a second language if wanted. Strings live in `assets/viewer/i18n.json`.
- **Zone regions** drawn as one shape per zone instead of a halo per component.
- **A rule for the container-runtime socket mounted into an app** (found by hand on DevPath).
