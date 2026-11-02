#!/usr/bin/env node
// Prints where a video project stands and the next command, from the files in its folder. Read-only: it runs
// nothing and installs nothing; it only looks at which files exist and which are newer than which.
// Usage: node pipeline.mjs <project-dir>
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, skillDir } from "./_lib.mjs";

/** Technical scene kinds and the prop that tells whether `video-explain` has filled them. */
const FILLED = {
  "rate-limit": "algos",
  "request-flow": "steps",
  code: "language",
  sequence: "source",
};
const STEP_SKILLS = [
  "video-write",
  "video-explain",
  "video-voice",
  "video-core",
  "video-captions",
  "video-qa",
  "video-publish",
];

const mtime = (f) => (existsSync(f) ? statSync(f).mtimeMs : 0);
const readJson = (f) => {
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};

/** Which sibling skills are installed next to this one. */
export function installedSkills(root = path.join(skillDir(), "..")) {
  return Object.fromEntries(
    STEP_SKILLS.map((n) => [n, existsSync(path.join(root, n, "SKILL.md"))]),
  );
}

/**
 * The steps of an explainer, each { id, name, status: "done" | "todo" | "stale" | "blocked", note, next }.
 * `installed` says which skills exist; a step whose skill is missing is "blocked".
 */
export function pipelineState(dir, installed) {
  const f = (...p) => path.join(dir, ...p);
  const video = readJson(f("video.json"));
  const steps = [];
  const step = (id, name, status, note, next, skill) =>
    steps.push({
      id,
      name,
      status: skill && !installed[skill] && status !== "done" ? "blocked" : status,
      note: skill && !installed[skill] && status !== "done" ? `install ${skill} first` : note,
      next,
    });

  const written = ["brief.json", "script.md", "facts.md", "storyboard.md"].filter(
    (n) => !existsSync(f(n)),
  );
  step(
    "write",
    "write",
    written.length ? "todo" : "done",
    written.length ? `missing ${written.join(", ")}` : "script, facts, storyboard written",
    `/video-write explain "<topic>"`,
    "video-write",
  );

  step(
    "storyboard",
    "storyboard",
    video ? "done" : "todo",
    video
      ? "approved, video.json written"
      : existsSync(f("storyboard.md"))
        ? "waiting for the user to approve storyboard.md"
        : "not written yet",
    `show storyboard.md; after approval: node <video-write>/scripts/storyboard.mjs ${dir}`,
    "video-write",
  );

  const open = (video?.scenes ?? []).filter(
    (s) => FILLED[s.kind] && !(s.props && FILLED[s.kind] in s.props),
  );
  const technical = (video?.scenes ?? []).filter((s) => FILLED[s.kind]).length;
  step(
    "scenes",
    "diagram scenes",
    !video ? "todo" : open.length ? "todo" : "done",
    !video
      ? "needs video.json"
      : open.length
        ? `to fill: ${open.map((s) => s.id).join(", ")}`
        : technical
          ? `${technical} filled`
          : "none needed",
    `/video-explain for ${open.map((s) => s.id).join(", ")}`,
    "video-explain",
  );

  const lines = [...new Set((video?.scenes ?? []).flatMap((s) => s.narration ?? []))];
  const voiced = video?.voice?.provider && video.voice.provider !== "none";
  const missing = lines.filter((id) => !existsSync(f("voice", `${id}.wav`)));
  step(
    "voice",
    "voice",
    !video ? "todo" : !voiced && !missing.length ? "done" : missing.length ? "todo" : "done",
    !video
      ? "needs video.json"
      : missing.length
        ? `${missing.length} of ${lines.length} line(s) have no audio`
        : voiced
          ? "all lines voiced"
          : "no narration to voice",
    "/video-voice (then align the words)",
    "video-voice",
  );

  const stamp = Math.max(
    mtime(f("video.json")),
    ...lines.map((id) => mtime(f("voice", `${id}.wav`))),
  );
  const timing = mtime(f("timing.json"));
  step(
    "timing",
    "timing",
    !timing ? "todo" : timing < stamp ? "stale" : "done",
    !timing
      ? "timing.json missing"
      : timing < stamp
        ? "video.json or voice changed since"
        : "scene lengths set",
    `node <video-core>/scripts/timing.mjs ${dir}`,
    "video-core",
  );

  const cap = mtime(f("captions.json"));
  step(
    "captions",
    "captions",
    !cap ? "todo" : cap < timing ? "stale" : "done",
    !cap
      ? "captions.json missing (skip with --srt only if the user wants no burned captions)"
      : "captions grouped",
    "/video-captions --burn",
    "video-captions",
  );

  const outDir = f("out");
  const mp4s = existsSync(outDir)
    ? readdirSync(outDir).filter((n) => n.endsWith(".mp4") && n !== "silent.mp4")
    : [];
  const final =
    mp4s
      .filter((n) => !n.endsWith("-draft.mp4"))
      .map((n) => mtime(path.join(outDir, n)))
      .sort()
      .at(-1) ?? 0;
  const need = Math.max(stamp, timing, cap);
  step(
    "render",
    "render",
    !final ? "todo" : final < need ? "stale" : "done",
    !final
      ? mp4s.length
        ? "only a draft so far"
        : "no video yet"
      : final < need
        ? "files changed after the last render"
        : "final render is current",
    `node <video-core>/scripts/render.mjs ${dir} (--draft first)`,
    "video-core",
  );

  const report = readJson(f("qa", "report.json"));
  const qa = mtime(f("qa", "report.json"));
  step(
    "qa",
    "QA",
    !final || !report ? "todo" : qa < final ? "stale" : report.ok ? "done" : "todo",
    !final
      ? "after the final render"
      : !report
        ? "not checked"
        : qa < final
          ? "render is newer than the last QA"
          : report.ok
            ? "passed"
            : `${report.results.filter((r) => r.level === "fail").length} check(s) failed`,
    "/video-qa",
    "video-qa",
  );

  const pack = mtime(f("exports", "publish.json"));
  const hasCopy = existsSync(f("publish", "copy.json"));
  step(
    "publish",
    "publish",
    !pack ? "todo" : pack < final ? "stale" : "done",
    !pack
      ? hasCopy
        ? "no export pack yet"
        : "write publish/copy.json, then export"
      : pack < final
        ? "the render is newer than the export pack"
        : "pack written (nothing uploaded)",
    hasCopy
      ? "/video-publish --platforms shorts,reels,tiktok (never uploads)"
      : "write publish/copy.json from the brief and facts, then /video-publish",
    "video-publish",
  );
  return steps;
}

function main() {
  const target = process.argv[2];
  const dir = target && path.resolve(target);
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error("Usage: node pipeline.mjs <project-dir>");
    process.exit(2);
  }
  const steps = pipelineState(dir, installedSkills());
  const mark = { done: "done   ", todo: "todo   ", stale: "stale  ", blocked: "blocked" };
  const lines = steps.map((s, i) => `${i + 1}. ${s.name.padEnd(14)} ${mark[s.status]} ${s.note}`);
  const next =
    steps.find((s) => s.status === "todo" || s.status === "stale") ??
    steps.find((s) => s.status === "blocked");
  console.log(
    capLines(
      lines,
      next
        ? `Next: ${next.next ?? next.note}`
        : "Every step is done. Read exports/*/disclosure.md, then upload by hand: nothing was uploaded.",
    ),
  );
}

if (isEntry(import.meta.url)) main();
