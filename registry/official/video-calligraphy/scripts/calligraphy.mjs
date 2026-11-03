#!/usr/bin/env node
// Turns a text file of quotes into a draft kinetic-lettering project: one `calligraphy` scene per quote, with
// no voice. Each line is `text | translation | by` (the last two are optional). The text is used exactly as
// given: never reshaped, respelled or stretched. Lettering that cannot join (pre-shaped letters) is refused.
// Usage: node calligraphy.mjs --quotes quotes.txt --out projects/<slug> [--font Amiri-Regular] [--reveal wipe|fade|rise] [--format reel-9x16]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { calligraphyProblems, dirOf, hasArabic, REVEALS, wordsOf } from "./_text.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const FORMATS = ["reel-9x16", "short-9x16", "youtube-16x9", "square-1x1"];
const MAX_QUOTES = 8;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Quote entries from the file's text: { text, translation?, by? }. Blank lines and `#` comments are skipped. */
export function parseQuotes(text) {
  return String(text)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [t, tr, by] = l.split("|").map((x) => x.trim());
      return { text: t, ...(tr ? { translation: tr } : {}), ...(by ? { by } : {}) };
    });
}

/** The video.json for the quotes. Pure. Throws a sentence when a quote cannot be drawn. */
export function buildCalligraphy(quotes, { font, reveal = "wipe", format = "reel-9x16" }) {
  if (!quotes.length || quotes.length > MAX_QUOTES)
    throw new Error(`Give 1 to ${MAX_QUOTES} quotes.`);
  const scenes = quotes.map((q, i) => {
    const props = { ...q, ...(font ? { font } : {}), reveal };
    const bad = calligraphyProblems(props);
    if (bad.length) throw new Error(`Quote ${i + 1}: ${bad[0]}`);
    if (!hasArabic(q.text))
      throw new Error(`Quote ${i + 1} has no Arabic letters; this skill is for Arabic lettering.`);
    return {
      id: `s${i + 1}`,
      kind: "calligraphy",
      durationFrom: "fixed",
      seconds: Math.max(4, Math.round((1.6 + wordsOf(q.text).length * 0.8) * 10) / 10),
      props,
      transitionIn: i ? "fade" : "cut",
    };
  });
  return {
    version: 1,
    meta: {
      title: "Calligraphy",
      type: "custom",
      format,
      fps: 30,
      lang: "ar",
      dir: dirOf(quotes[0].text),
      audience: "Arabic readers",
    },
    voice: { provider: "none" },
    scenes,
  };
}

function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), {
      strings: ["quotes", "out", "font", "reveal", "format"],
    });
    if (!flags.quotes || !flags.out)
      throw new Error("Give --quotes quotes.txt and --out projects/<slug>");
    if (statSync(flags.quotes).size > 64 * 1024)
      throw new Error("The quotes file is larger than 64 KB; refusing to read it.");
    const format = flags.format ?? "reel-9x16";
    if (!FORMATS.includes(format)) throw new Error(`--format is one of ${FORMATS.join(", ")}.`);
    const reveal = flags.reveal ?? "wipe";
    if (!REVEALS.includes(reveal)) throw new Error(`--reveal is one of ${REVEALS.join(", ")}.`);
    if (existsSync(path.join(flags.out, "video.json")))
      throw new Error(
        `${flags.out}/video.json exists; choose a new folder so nothing is overwritten.`,
      );
    const video = buildCalligraphy(parseQuotes(readFileSync(flags.quotes, "utf8")), {
      font: flags.font,
      reveal,
      format,
    });
    mkdirSync(flags.out, { recursive: true });
    writeFileSync(path.join(flags.out, "video.json"), `${JSON.stringify(video, null, 2)}\n`);
    console.log(
      capLines(
        [
          `Wrote ${flags.out}/video.json: ${plural(video.scenes.length, "quote", "quotes")}, ${reveal} reveal, ${video.scenes.reduce((n, s) => n + s.seconds, 0).toFixed(1)} s.`,
          flags.font
            ? `Font: ${flags.font} (the file must be in brand/fonts)`
            : "Font: the brand font (add an Arabic font to brand/fonts)",
        ],
        "Look at one draft frame per quote: check that letters join and marks are not clipped.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
