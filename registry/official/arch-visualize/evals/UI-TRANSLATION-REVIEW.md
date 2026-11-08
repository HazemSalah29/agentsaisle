# Arabic interface text: needs native review

The Arabic strings in `assets/viewer/i18n.json` (`ar`) are a machine draft written for 0.2.0. They have not been read by a native speaker. Before the numbers or screenshots of the Arabic page are published, ask a native speaker to check:

- tone and grammar of the sentences (`header.note`, `intro.*`, `risks.note`, `flow.reduced`);
- the plural forms (`count.*`, `flow.panel.meta`, `node.*.risks`), which follow the six CLDR categories for Arabic;
- the terms for technical ideas: "الحافة" (edge), "غير المتزامن" (async), "ذاكرة مؤقتة" (cache), "طبقة" (tier);
- the Changes view (`diff.*`, `lens.diff`): "مضاف / معدَّل / محذوف / أُعيدت تسميته" for added / changed / removed / renamed, and the sentence in `diff.note`;
- the direction of the arrows: flow text uses "←" in Arabic so it reads in the order a reader follows.

What stays in the original language on purpose: labels, flow names, risk text and evidence notes written in the model (they are the project's own text), technology names, file paths and rule ids. Numerals are written 0-9.

## Added with the inside view (0.3.0)

The strings `detail.*` (the Back bar, "Inside this component", column names) and `sym.*` (kinds such as component, function and hook; "loop", "if"; the side panel for one function) have an Arabic draft too. Same rules: machine draft, not read by a native speaker. Please also check how the diagram reads in Arabic with `--lang ar --flow-dir rtl`: card text is right-aligned and the call chain runs right to left. "tRPC" and "HTTP" stay in Latin letters on purpose.
