#!/usr/bin/env node
// Builds the pack for posting a finished video: a re-encoded file per platform, thumbnails, the checked text,
// captions, credits and disclosure notes, and a manifest with hashes. It never uploads anything.
// Usage: node publish.mjs <project-dir> --platforms youtube,shorts,reels,tiktok,linkedin
//          [--override-qa "reason of at least 15 characters"] [--no-card] [--force]
// Needs: out/<name>.mp4, qa/report.json (passing and current), credits.json, publish/copy.json, script.md, facts.md.
// Exit: 0 pack written, 1 refused (the reasons are printed), 2 could not run.
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { chapterList, copyProblems, disclosureNote, kidsAnswer } from "./copycheck.mjs";
import { encode, ffmpeg, input, probe } from "./ffwrap.mjs";
import { run } from "./run.mjs";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";

export const loadPlatforms = () =>
  JSON.parse(readFileSync(path.join(skillDir(), "assets", "platforms.json"), "utf8"));

const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const mtime = (f) => (existsSync(f) ? statSync(f).mtimeMs : 0);
const readJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);
const RATIOS = { "9:16": 9 / 16, "16:9": 16 / 9, "1:1": 1 };

/** The shape of a picture as one of the names in platforms.json, or null when it is none of them. */
export function aspectName(w, h) {
  const r = w / h;
  return Object.entries(RATIOS).find(([, v]) => Math.abs(r - v) < 0.02)?.[0] ?? null;
}

/** Why this project may not be published yet, as strings. Empty means it may. `override` is the reason given. */
export function gateProblems(dir, name, override) {
  const f = (...p) => path.join(dir, ...p);
  const mp4 = f("out", `${name}.mp4`);
  const out = [];
  if (!existsSync(mp4))
    return [`there is no final render (out/${name}.mp4); render it with video-core first`];
  const report = readJson(f("qa", "report.json"));
  const credits = mtime(f("credits.json"));
  if (!credits) out.push("credits.json is missing; run video-core credits.mjs");
  else if (credits < mtime(f("video.json")))
    out.push("credits.json is older than video.json; run credits.mjs again");
  const qa = [];
  if (!report) qa.push("qa/report.json is missing; run video-qa");
  else {
    if (!report.ok) qa.push("the last QA failed; fix what it listed and run video-qa again");
    if (mtime(f("qa", "report.json")) < mtime(mp4))
      qa.push("the render is newer than the last QA; run video-qa again");
  }
  if (mtime(mp4) < Math.max(mtime(f("video.json")), mtime(f("timing.json"))))
    qa.push("video.json or timing.json changed after the render; render again");
  if (qa.length) {
    if (override === undefined) out.push(...qa);
    else if (String(override).trim().length < 15)
      out.push("--override-qa needs a reason of at least 15 characters");
  }
  return out;
}

/** Whether HyperFrames-based thumbnail cards can be made here: the video-core skill sits next to this one. */
const coreScripts = () => path.join(skillDir(), "..", "video-core", "scripts");

/** A designed card: the title as a one-scene video rendered by video-core, one frame taken from it. Best effort. */
function makeCard({ dir, video, title, promise, out, format }) {
  const core = coreScripts();
  if (!existsSync(path.join(core, "render.mjs")))
    throw new Error("video-core is not installed next to this skill");
  const work = mkdtempSync(path.join(os.tmpdir(), "video-card-"));
  try {
    const proj = path.join(work, "card");
    mkdirSync(proj, { recursive: true });
    const meta = {
      title: title.slice(0, 120),
      type: "explainer",
      format,
      fps: 30,
      lang: video.meta.lang ?? "en",
      ...(video.meta.dir ? { dir: video.meta.dir } : {}),
    };
    const brandRel = video.meta.brand;
    if (brandRel && existsSync(path.join(dir, brandRel))) {
      mkdirSync(path.dirname(path.join(proj, brandRel)), { recursive: true });
      copyFileSync(path.join(dir, brandRel), path.join(proj, brandRel));
      meta.brand = brandRel;
      const fonts = path.join(dir, "brand", "fonts");
      if (existsSync(fonts)) {
        mkdirSync(path.join(proj, "brand", "fonts"), { recursive: true });
        for (const n of readdirSync(fonts))
          copyFileSync(path.join(fonts, n), path.join(proj, "brand", "fonts", n));
      }
    }
    const props = {
      text: title.slice(0, 120),
      ...(promise ? { subtitle: promise.slice(0, 200) } : {}),
    };
    writeFileSync(
      path.join(proj, "video.json"),
      JSON.stringify({
        version: 1,
        meta,
        scenes: [{ id: "card", kind: "title", durationFrom: "fixed", seconds: 1, props }],
      }),
    );
    for (const step of [
      ["timing.mjs", [proj]],
      ["render.mjs", [proj]],
    ]) {
      const r = run("node", [path.join(core, step[0]), ...step[1]], { timeoutMs: 600_000 });
      if (r.status !== 0)
        throw new Error(
          `${step[0]} failed: ${String(r.stderr || r.stdout)
            .trim()
            .split("\n")
            .slice(-1)[0]
            .slice(0, 120)}`,
        );
    }
    const mp4 = path.join(proj, "out", "card.mp4");
    ffmpeg([...input(mp4), "-frames:v", "1", "-q:v", "2", "-y", out]);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Build the pack. Returns { lines, manifest } or throws; `refused` lists reasons when nothing was written. */
export function publishProject({ dir, platforms, override, card = true, force = false }) {
  const f = (...p) => path.join(dir, ...p);
  const name = path.basename(dir).replace(/[^A-Za-z0-9._-]/g, "-") || "video";
  const all = loadPlatforms();
  const refused = [];
  for (const id of platforms)
    if (!all.platforms[id])
      refused.push(`unknown platform "${id}" (have: ${Object.keys(all.platforms).join(", ")})`);
  if (refused.length) return { refused };
  const video = readJson(f("video.json"));
  if (!video) return { refused: ["video.json is missing"] };
  const copy = readJson(f("publish", "copy.json"));
  if (!copy)
    return {
      refused: [
        "publish/copy.json is missing: write title, description and hashtags from the brief and facts",
      ],
    };
  const sourceText = ["script.md", "facts.md"]
    .map((n) => (existsSync(f(n)) ? readFileSync(f(n), "utf8") : ""))
    .join("\n");
  if (!sourceText.trim())
    return {
      refused: ["script.md and facts.md are missing, so the numbers in the text cannot be checked"],
    };
  refused.push(...gateProblems(dir, name, override));
  if (refused.length) return { refused };

  const mp4 = f("out", `${name}.mp4`);
  const info = probe(mp4);
  const aspect = aspectName(info.width, info.height);
  const chap = chapterList(
    video,
    readJson(f("timing.json")) ?? { scenes: [], totalSeconds: info.seconds },
  );
  const plans = platforms.map((id) => {
    const pl = all.platforms[id];
    const problems = [];
    if (!aspect || !pl.aspects.includes(aspect))
      problems.push(
        `the video is ${info.width}x${info.height} (${aspect ?? "no standard shape"}); ${pl.name} takes ${pl.aspects.join(" or ")}. Use video-edit reframe first`,
      );
    if (info.seconds > pl.maxSeconds)
      problems.push(
        `${Math.round(info.seconds)} s is over the ${pl.maxSeconds} s limit used for ${pl.name}`,
      );
    const text = {
      ...copy,
      description:
        pl.chapters && chap.chapters.length
          ? `${copy.description}\n\n${chap.text}`
          : copy.description,
    };
    problems.push(...copyProblems(text, pl, sourceText));
    return { id, pl, text, problems };
  });
  for (const p of plans) for (const x of p.problems) refused.push(`${p.id}: ${x}`);
  if (refused.length) return { refused };
  const root = f("exports");
  for (const p of plans)
    if (existsSync(path.join(root, p.id)) && !force)
      refused.push(`exports/${p.id} already exists; use --force to replace it`);
  if (refused.length) return { refused };

  const brief = readJson(f("brief.json"));
  const credits = readJson(f("credits.json"));
  const kids = kidsAnswer(brief);
  const notes = [];
  const manifest = {
    version: 1,
    project: name,
    uploaded: false,
    source: {
      file: `out/${name}.mp4`,
      sha256: sha(mp4),
      seconds: Math.round(info.seconds * 100) / 100,
    },
    qa: {
      ok: true,
      overridden:
        override !== undefined && !readJson(f("qa", "report.json"))?.ok
          ? String(override).trim()
          : undefined,
    },
    platforms: [],
  };
  for (const p of plans) {
    const dest = path.join(root, p.id);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    const [maxW] = p.pl.size;
    const vf = `scale='min(iw,${maxW})':-2${info.fps > 30.5 ? ",fps=30" : ""}`;
    ffmpeg([
      ...input(mp4),
      "-vf",
      vf,
      ...encode({ audio: info.audio }),
      "-maxrate",
      "8M",
      "-bufsize",
      "16M",
      "-profile:v",
      "high",
      "-y",
      path.join(dest, "video.mp4"),
    ]);
    [0.15, 0.45, 0.75].forEach((q, i) =>
      ffmpeg([
        ...input(mp4),
        "-ss",
        String(Math.round(info.seconds * q * 100) / 100),
        "-vf",
        "thumbnail=n=45",
        "-frames:v",
        "1",
        "-q:v",
        "2",
        "-y",
        path.join(dest, `thumbnail-${i + 1}.jpg`),
      ]),
    );
    if (card) {
      try {
        makeCard({
          dir,
          video,
          title: copy.title || brief?.title || video.meta.title,
          promise: brief?.promise,
          out: path.join(dest, "thumbnail-card.jpg"),
          format: video.meta.format,
        });
      } catch (e) {
        notes.push(`${p.id}: the designed thumbnail card was skipped (${e.message})`);
      }
    }
    writeFileSync(
      path.join(dest, "copy.json"),
      `${JSON.stringify({ title: p.text.title, description: p.text.description, hashtags: p.text.hashtags ?? [] }, null, 2)}\n`,
    );
    for (const [from, to] of [
      ["captions.srt", "captions.srt"],
      ["captions.vtt", "captions.vtt"],
      ["CREDITS.txt", "CREDITS.txt"],
    ])
      if (existsSync(f(from))) copyFileSync(f(from), path.join(dest, to));
    writeFileSync(
      path.join(dest, "disclosure.md"),
      `${disclosureNote({ platform: p.pl, credits, kids, override: manifest.qa.overridden })}\n`,
    );
    const files = [
      "video.mp4",
      "thumbnail-1.jpg",
      "thumbnail-2.jpg",
      "thumbnail-3.jpg",
      "thumbnail-card.jpg",
      "copy.json",
      "captions.srt",
      "captions.vtt",
      "CREDITS.txt",
      "disclosure.md",
    ].filter((n) => existsSync(path.join(dest, n)));
    manifest.platforms.push({
      platform: p.id,
      files: files.map((n) => ({
        path: `${p.id}/${n}`,
        bytes: statSync(path.join(dest, n)).size,
        sha256: sha(path.join(dest, n)),
      })),
    });
  }
  manifest.statement =
    "Nothing was uploaded. Upload by hand, and answer each platform's own questions using disclosure.md.";
  if (!chap.chapters.length && plans.some((p) => p.pl.chapters))
    notes.push(`chapters: ${chap.note}`);
  writeFileSync(path.join(root, "publish.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const lines = [
    `Pack for ${plans.map((p) => p.id).join(", ")} in exports/ (${name}.mp4, ${info.width}x${info.height}, ${Math.round(info.seconds)} s):`,
  ];
  for (const m of manifest.platforms)
    lines.push(
      `  ${m.platform}: ${m.files.length} files, video ${Math.round(m.files[0].bytes / 1024)} KB, kids answer: ${all.platforms[m.platform].madeForKids ? kids : "n/a"}`,
    );
  if (manifest.qa.overridden) lines.push(`QA was overridden: ${manifest.qa.overridden}`);
  lines.push(...notes.map((n) => `note: ${n}`));
  return { lines, manifest };
}

function main() {
  try {
    const { flags, positional } = parseArgs(process.argv.slice(2), {
      booleans: ["no-card", "force"],
      strings: ["platforms", "override-qa"],
    });
    if (!positional[0] || !flags.platforms)
      throw new Error(
        'Usage: node publish.mjs <project-dir> --platforms youtube,shorts,reels,tiktok,linkedin [--override-qa "reason"] [--no-card] [--force]',
      );
    const dir = path.resolve(positional[0]);
    if (!existsSync(dir)) throw new Error(`No folder ${positional[0]}.`);
    const r = publishProject({
      dir,
      platforms: String(flags.platforms)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      override: flags["override-qa"],
      card: !flags["no-card"],
      force: Boolean(flags.force),
    });
    if (r.refused) {
      console.log(
        capLines(
          r.refused.map((x) => `REFUSED  ${x}`),
          `Nothing was written. ${r.refused.length} reason(s).`,
        ),
      );
      process.exit(1);
    }
    console.log(
      capLines(
        r.lines,
        "Nothing was uploaded; upload by hand. Read each disclosure.md before you answer the platform's questions.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
