// Rules for videos made for children. Pure functions over the project's own files (video.json, the script,
// timing.json, captions.json); no ffmpeg and no process is started here. Numbers come from assets/rules.json.
// These are working defaults, not platform rules, and they cannot judge whether a story is good for a child.

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r1 = (n) => Math.round(n * 10) / 10;

/** True for a kids' video: the project says so by its type or its audience. */
export const isKids = (video) =>
  video?.meta?.type === "kids" || /^kids\b/i.test(video?.meta?.audience ?? "");

/** "3-5" or "6-9" from the audience ("kids-3-5"); null when it names neither. */
export const ageBand = (audience = "") =>
  /(\d)\s*[-–]\s*(\d)/.exec(audience)?.slice(1, 3).join("-") ?? null;

/** Words and sentences of the script's narration, by line id: [{ id, words, longest }]. */
export function scriptLines(script) {
  const out = [];
  for (const m of script.matchAll(/^\s*(?:[-*]\s*)?\[([a-z0-9-]{1,32})\]\s*(.+)$/gm)) {
    const text = m[2].trim();
    const sentences = text.split(/(?<=[.!?؟])\s+/).filter(Boolean);
    const count = (s) => s.split(/\s+/).filter(Boolean).length;
    out.push({ id: m[1], words: count(text), longest: Math.max(0, ...sentences.map(count)) });
  }
  return out;
}

const matcher = (words) =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
const found = (re, texts) => [
  ...new Set(texts.flatMap((t) => [...t.matchAll(re)].map((m) => m[0].toLowerCase()))),
];

/** Every string value in the scenes' props. */
export function propStrings(video) {
  return (
    JSON.stringify((video.scenes ?? []).map((s) => s.props ?? {})).match(/"((?:[^"\\]|\\.)*)"/g) ??
    []
  )
    .map((s) => JSON.parse(s))
    .filter((s) => /\s|\p{L}{3}/u.test(s));
}

/**
 * The kids' checks as [{ id, level, text }]. `input`: { video, script (text or ""), timing (or null),
 * captions (parsed captions.json or null), bibles (Set of character names that have a bible.md) }.
 */
export function kidsChecks(
  { video, script = "", timing = null, captions = null, bibles = new Set() },
  rules,
) {
  const K = rules.kids;
  const out = [];
  const add = (id, level, text) => out.push({ id, level, text });
  const band = ageBand(video.meta.audience);
  const strict = band ?? "3-5";
  add(
    "kids-audience",
    band ? "pass" : "fail",
    band
      ? `audience ${video.meta.audience}: the made-for-kids answer is "yes" in the publish pack`
      : 'set meta.audience to "kids-3-5" or "kids-6-9" so pace limits and the made-for-kids answer follow',
  );

  const lines = scriptLines(script);
  const seconds = new Map(
    (timing?.scenes ?? []).flatMap((s) => s.lines ?? []).map((l) => [l.id, l.seconds]),
  );
  const capPace = K.paceWordsPerSecond[strict];
  const paced = lines
    .filter((l) => seconds.get(l.id) > 0.5)
    .map((l) => ({ id: l.id, wps: l.words / seconds.get(l.id) }))
    .sort((a, b) => b.wps - a.wps);
  if (!paced.length) add("kids-pace", "warn", "no voiced lines with timing to measure the pace of");
  else if (paced[0].wps > capPace * 1.3)
    add(
      "kids-pace",
      "fail",
      `line ${paced[0].id} runs ${r1(paced[0].wps)} words a second (limit ${capPace} for ages ${strict})`,
    );
  else if (paced[0].wps > capPace)
    add(
      "kids-pace",
      "warn",
      `line ${paced[0].id} runs ${r1(paced[0].wps)} words a second (limit ${capPace} for ages ${strict})`,
    );
  else
    add(
      "kids-pace",
      "pass",
      `slowest line check: at most ${r1(paced[0].wps)} words a second (limit ${capPace})`,
    );

  const capLen = K.sentenceWords[strict];
  const long = lines.filter((l) => l.longest > capLen);
  add(
    "kids-sentences",
    long.length ? "warn" : "pass",
    long.length
      ? `line ${long[0].id} has a sentence of ${long[0].longest} words (at most ${capLen} for ages ${strict})`
      : `sentences are at most ${capLen} words`,
  );

  const texts = [script, ...propStrings(video)].filter(Boolean);
  const pressure = found(matcher(K.pressure), texts);
  add(
    "kids-pressure",
    pressure.length ? "fail" : "pass",
    pressure.length
      ? `asks children to act ("${pressure[0]}"); take it out`
      : "no like, subscribe or follow pressure",
  );
  const kind = [...found(matcher(K.unkind), texts), ...found(matcher(K.frightening), texts)];
  add(
    "kids-language",
    kind.length ? "warn" : "pass",
    kind.length
      ? `read these in context for kindness and no frightening peril: ${kind.slice(0, 5).join(", ")}`
      : "no unkind or frightening words from the list",
  );

  const quick = (timing?.scenes ?? []).filter((s) => s.seconds < K.minSceneSeconds);
  add(
    "kids-cuts",
    quick.length ? "warn" : "pass",
    quick.length
      ? `scene "${quick[0].id}" lasts ${r1(quick[0].seconds)} s (at least ${K.minSceneSeconds} s keeps the pace gentle)`
      : `every scene lasts at least ${K.minSceneSeconds} s`,
  );

  if (captions) {
    const size = num(captions.style?.size);
    add(
      "kids-caption-size",
      size >= K.captionMinSize ? "pass" : "fail",
      `captions are ${r1(size * 100)}% of the height (at least ${K.captionMinSize * 100}% for children)`,
    );
  } else
    add(
      "kids-caption-size",
      "warn",
      "no captions.json: young readers need big captions (run video-captions --style kids)",
    );

  const rigs = [
    ...new Set(
      (video.scenes ?? []).flatMap((s) =>
        s.kind === "puppet" ? (s.props?.cast ?? []).map((c) => c.rig) : [],
      ),
    ),
  ];
  const missing = rigs.filter((r) => !bibles.has(r));
  if (rigs.length)
    add(
      "kids-characters",
      missing.length ? "fail" : "pass",
      missing.length
        ? `character "${missing[0]}" has no characters/${missing[0]}/bible.md (original characters need a bible)`
        : `every character has a bible (${rigs.join(", ")})`,
    );
  if ((video.scenes ?? []).some((s) => s.kind === "broll"))
    add(
      "kids-footage",
      "warn",
      "a broll scene shows real pictures or footage: check that no real child is shown and every licence is right",
    );
  return out;
}
