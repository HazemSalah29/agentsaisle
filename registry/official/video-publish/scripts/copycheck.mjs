// The checks behind `publish`: platform text rules, numbers that must come from the script, chapters and the
// disclosure note. Pure; it reads no file and runs nothing.

const NUMBER = /\d+(?:[.,]\d+)*/g;
const PLACEHOLDER = /\b(TODO|TBD|FIXME|XXX)\b|lorem ipsum|\[needs-source\]|\?\?\?/i;

const bytes = (s) => Buffer.byteLength(s, "utf8");
const norm = (s) => String(s).replace(/,/g, "");

/**
 * Problems with the agent-written copy.json for one platform, as strings (empty means fine).
 * `sourceText` is the script and the facts, which every number in the copy has to appear in.
 */
export function copyProblems(copy, platform, sourceText) {
  const p = [];
  if (!copy || typeof copy !== "object")
    return ["copy.json must be an object with title, description and hashtags."];
  const { title = "", description = "", hashtags = [] } = copy;
  if (typeof title !== "string" || typeof description !== "string")
    return ["title and description must be text."];
  if (platform.titleMax > 0) {
    if (!title.trim()) p.push("title: required");
    else if ([...title].length > platform.titleMax)
      p.push(`title: ${[...title].length} characters, at most ${platform.titleMax}`);
  }
  if (!description.trim()) p.push("description: required");
  const size = platform.descriptionUnit === "bytes" ? bytes(description) : [...description].length;
  if (size > platform.descriptionMax)
    p.push(`description: ${size} ${platform.descriptionUnit}, at most ${platform.descriptionMax}`);
  if (platform.noAngleBrackets && /[<>]/.test(title + description))
    p.push("title and description: the characters < and > are not allowed");
  if (!Array.isArray(hashtags)) p.push("hashtags: must be a list");
  else {
    if (hashtags.length > platform.hashtagsMax)
      p.push(`hashtags: ${hashtags.length}, at most ${platform.hashtagsMax}`);
    const seen = new Set();
    hashtags.forEach((h, i) => {
      if (typeof h !== "string" || !/^#[\p{L}\p{N}_]{1,40}$/u.test(h))
        p.push(
          `hashtags[${i}]: "${String(h).slice(0, 20)}" is not a hashtag (# then letters, digits or _)`,
        );
      else if (seen.has(h.toLowerCase())) p.push(`hashtags[${i}]: "${h}" is used twice`);
      else seen.add(h.toLowerCase());
    });
  }
  const m = PLACEHOLDER.exec(`${title}\n${description}`);
  if (m) p.push(`leftover placeholder "${m[0]}"`);
  // Every number must come from the script or the facts: no invented statistics. Timestamps of chapters are exempt.
  const body = `${title}\n${description}`
    .split("\n")
    .filter((l) => !/^\s*\d{1,2}:\d{2}(?::\d{2})?\s/.test(l))
    .join("\n");
  const known = new Set((norm(sourceText).match(NUMBER) ?? []).map(norm));
  const words = norm(sourceText).toLowerCase();
  for (const n of new Set((norm(body).match(NUMBER) ?? []).map(norm)))
    if (!known.has(n) && !words.includes(n))
      p.push(`the number ${n} does not appear in script.md or facts.md (never invent a figure)`);
  return p;
}

const fmt = (t) => {
  const s = Math.round(t);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/** A scene's name for a chapter: the first of its title-like props. */
export function sceneName(scene) {
  const pr = scene.props ?? {};
  const t = [pr.title, pr.heading, pr.text, pr.subtitle].find(
    (x) => typeof x === "string" && x.trim(),
  );
  return t ? t.trim().replace(/\s+/g, " ").slice(0, 60) : null;
}

/**
 * YouTube chapters from the scenes: the first at 0:00, every chapter at least 10 s long (shorter scenes join the
 * one before), and at least 3 or none. Returns { chapters: [{ at, name }], text } or { chapters: [], note }.
 */
export function chapterList(video, timing) {
  const out = [];
  timing.scenes.forEach((t, i) => {
    const name = sceneName(video.scenes[i] ?? {}) ?? `Part ${out.length + 1}`;
    if (!out.length) out.push({ at: 0, name });
    else if (t.start - out[out.length - 1].at >= 10 && timing.totalSeconds - t.start >= 3)
      out.push({ at: t.start, name });
  });
  if (out.length < 3)
    return {
      chapters: [],
      note: `only ${out.length} chapter(s) of at least 10 s; YouTube needs 3, so none are added`,
    };
  return { chapters: out, text: out.map((c) => `${fmt(c.at)} ${c.name}`).join("\n") };
}

/** Whether the audience makes this a kids' video: "yes", "no" or "ask" (the owner decides). */
export function kidsAnswer(brief) {
  const a = String(brief?.audience ?? "");
  if (/\bkids?\b|\bchild(ren)?\b|أطفال|اطفال/i.test(a)) return "yes";
  if (!a) return "ask";
  return /\b(developers?|engineers?|adults?|professionals?|teams?)\b/i.test(a) ? "no" : "ask";
}

/** The text of disclosure.md for one platform. */
export function disclosureNote({ platform, credits, kids, override }) {
  const lines = [`# Disclosure for ${platform.name}`, "", platform.disclosure, ""];
  if (platform.madeForKids)
    lines.push(
      "## Made for kids",
      "",
      {
        yes: "Yes: mark this video as made for kids.",
        no: "No, according to the audience in brief.json. You are still the one who answers it on the platform.",
        ask: "Decide: the audience in brief.json does not say clearly. The platform needs a yes or a no.",
      }[kids],
      "",
    );
  lines.push(
    "## From the assets",
    "",
    ...(credits?.guidance?.length
      ? credits.guidance.map((g) => `- ${g}`)
      : ["- No guidance was recorded; run credits.mjs."]),
    "",
  );
  if (override)
    lines.push("## QA override", "", `The check failed and was overridden: ${override}`, "");
  lines.push("Platform rules change. Check the platform's own help page before you publish.");
  return lines.join("\n");
}
