// Entry for the vendored highlighter (registry/build-vendor-shiki.mjs bundles it). Uses Shiki's JavaScript regex
// engine, so there is no WebAssembly and no network. One dark theme and five languages keep the file small.
import { readFileSync } from "node:fs";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Grammars and the theme are plain JSON files next to this bundle (shiki-data/), pretty-printed so they can be
// read; registry/build-vendor-shiki.mjs writes them from the pinned Shiki package.
const data = (name) =>
  JSON.parse(readFileSync(new URL(`./shiki-data/${name}.json`, import.meta.url), "utf8"));

export const THEME = "github-dark";
/** Language names and aliases the code scene accepts. */
export const LANGS = {
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  json: "json",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  python: "python",
  py: "python",
};

// Built on first use, so a project without code scenes does not pay for it.
let highlighter;
const get = () =>
  (highlighter ??= createHighlighterCoreSync({
    themes: [data("github-dark")],
    langs: ["javascript", "typescript", "json", "bash", "python"].flatMap(data),
    engine: createJavaScriptRegexEngine(),
  }));

/** Tokens per line: [[{ content, color }]]. Throws for a language outside LANGS. */
export function tokens(code, lang) {
  const id = LANGS[lang];
  if (!id)
    throw new Error(
      `Language "${lang}" is not in the bundle (have: ${Object.keys(LANGS).join(", ")})`,
    );
  return get()
    .codeToTokensBase(code, { lang: id, theme: THEME })
    .map((line) => line.map((t) => ({ content: t.content, color: t.color ?? "#E1E4E8" })));
}
