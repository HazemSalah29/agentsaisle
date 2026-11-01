#!/usr/bin/env node
// Writes credits.json and CREDITS.txt for a project and works out the disclosure flags from its assets.
// Fails (writes nothing) when an asset has no licence or when video.json declares less than the assets imply.
// Output has no timestamps, so the same project gives the same files. Read-only apart from those two files.
// Usage: node credits.mjs <project-dir>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const CLONE_RANK = { none: 0, self: 1, consented: 2 };

/** Disclosure flags implied by the assets. A flag is true when any asset says so. */
export function computeDisclosure(video) {
  const assets = video.assets ?? [];
  const musicPath = video.music?.asset;
  const ai = (a) => a.aiGenerated === true;
  const visual = (a) =>
    a.kind === "image" ||
    a.kind === "video" ||
    /\.(png|jpe?g|webp|mp4|mov|webm)$/i.test(a.path ?? "");
  const music = (a) =>
    (musicPath !== undefined && a.path === musicPath) ||
    (a.kind === "audio" && /music/i.test(a.path ?? ""));
  let voiceClone = "none";
  for (const a of assets)
    if ((CLONE_RANK[a.voiceClone] ?? 0) > CLONE_RANK[voiceClone]) voiceClone = a.voiceClone;
  return {
    realisticSynthetic: assets.some((a) => ai(a) && visual(a) && a.realistic === true),
    aiMusic: assets.some((a) => ai(a) && music(a)),
    voiceClone,
  };
}

/** Plain-words advice for the publisher, with the reason. */
export function guidance(flags, video) {
  const out = [];
  if (flags.realisticSynthetic)
    out.push(
      "Turn on the altered or synthetic content label: realistic AI-generated visuals are used.",
    );
  else if ((video.assets ?? []).some((a) => a.aiGenerated))
    out.push(
      "No synthetic-content label needed for the visuals: AI assets are stylised, not realistic.",
    );
  else out.push("No synthetic-content label needed: no AI-generated assets are used.");
  if (flags.aiMusic) out.push("Disclose AI-generated music where the platform asks for it.");
  if (flags.voiceClone === "self")
    out.push("The voice is a clone of the creator's own voice (consent: self).");
  if (flags.voiceClone === "consented")
    out.push("The voice is a clone of another speaker with recorded consent.");
  if (video.meta?.audience?.startsWith("kids"))
    out.push('Kids audience: set "made for kids" when publishing.');
  return out;
}

/** Everything the two output files hold. Returns { ok, problems, credits }. */
export function buildCredits(video) {
  const problems = [];
  const assets = video.assets ?? [];
  for (const a of assets)
    if (!a.licence || !String(a.licence).trim()) problems.push(`asset "${a.id}" has no licence`);
  const computed = computeDisclosure(video);
  const declared = video.disclosure ?? {};
  for (const k of ["realisticSynthetic", "aiMusic"])
    if (computed[k] && declared[k] === false)
      problems.push(`disclosure.${k} is false but the assets say true`);
  if ((CLONE_RANK[computed.voiceClone] ?? 0) > (CLONE_RANK[declared.voiceClone ?? "none"] ?? 0))
    problems.push(
      `disclosure.voiceClone is "${declared.voiceClone ?? "none"}" but the assets say "${computed.voiceClone}"`,
    );
  const credits = {
    version: 1,
    title: video.meta?.title ?? "",
    voice: video.voice?.provider ?? "none",
    assets: assets.map((a) => ({
      id: a.id,
      path: a.path,
      source: a.source,
      licence: a.licence ?? "",
      attribution: a.attribution ?? "",
      aiGenerated: a.aiGenerated === true,
    })),
    disclosure: computed,
    guidance: guidance(computed, video),
  };
  return { ok: problems.length === 0, problems, credits };
}

/** CREDITS.txt: one block per asset, then the disclosure advice. */
export function creditsText(c) {
  const lines = [`Credits: ${c.title}`, ""];
  if (c.voice !== "none") lines.push(`Voice: ${c.voice}`, "");
  if (c.assets.length === 0) lines.push("No third-party or generated assets.", "");
  for (const a of c.assets) {
    lines.push(`${a.path}`);
    lines.push(`  source: ${a.source}${a.aiGenerated ? " (AI-generated)" : ""}`);
    lines.push(`  licence: ${a.licence}`);
    if (a.attribution) lines.push(`  attribution: ${a.attribution}`);
    lines.push("");
  }
  lines.push("Disclosure", ...c.guidance.map((g) => `- ${g}`), "");
  return lines.join("\n");
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const dir = path.resolve(parsed.positional[0] ?? "");
  const file = path.join(dir, "video.json");
  if (!parsed.positional[0] || !existsSync(file)) {
    console.error("Usage: node credits.mjs <project-dir>  (needs video.json)");
    process.exit(2);
  }
  const { ok, problems, credits } = buildCredits(JSON.parse(readFileSync(file, "utf8")));
  if (!ok) {
    console.error(capLines(problems, `${problems.length} problem(s); credits not written.`));
    process.exit(1);
  }
  writeFileSync(path.join(dir, "credits.json"), `${JSON.stringify(credits, null, 2)}\n`);
  writeFileSync(path.join(dir, "CREDITS.txt"), creditsText(credits));
  console.log(
    capLines(
      credits.guidance.map((g) => `- ${g}`),
      `Wrote credits.json and CREDITS.txt (${credits.assets.length} asset(s)).`,
    ),
  );
}

if (isEntry(import.meta.url)) main();
