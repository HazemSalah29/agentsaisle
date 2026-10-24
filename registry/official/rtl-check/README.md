# rtl-check

A small, read-only companion to `arabic-rtl`. After a model edits UI code in a project that already supports Arabic, it runs `rtl-scan` on the changed files only and fixes RTL problems in the new code, so the project does not drift back to physical left/right classes.

The three scripts in `scripts/` are copies of the ones in `arabic-rtl/scripts/` (skills install on their own). A test fails if they differ; edit the `arabic-rtl` originals and copy them over.

No eval numbers exist. `model: haiku` and the `paths`-free trigger are unverified choices; TODO(verify) the model alias list in Claude Code's model configuration docs.
