// Reads the files a puppet scene needs from the project folder: each character's rig
// (characters/<name>/puppet.json) and the mouth shapes made from the voice (voice/visemes.json).
// Text only: nothing in these files is ever run.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { rigProblems } from "../assets/puppet/rig.mjs";

const readJson = (f) => {
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};

/** Rigs of every character used in puppet scenes: { rigs: Map(name -> rig), problems }. */
export function loadRigs(video, dir) {
  const rigs = new Map();
  const problems = [];
  video.scenes.forEach((s, i) => {
    if (s?.kind !== "puppet") return;
    for (const [k, c] of (s.props?.cast ?? []).entries()) {
      const name = c?.rig;
      if (typeof name !== "string" || !/^[a-z][a-z0-9-]{0,31}$/.test(name) || rigs.has(name))
        continue;
      const at = `$.scenes[${i}].props.cast[${k}].rig`;
      const file = path.join(dir, "characters", name, "puppet.json");
      if (!existsSync(file)) {
        problems.push(`${at}: characters/${name}/puppet.json is missing (video-kids makes it)`);
        continue;
      }
      const rig = readJson(file);
      const bad = rigProblems(rig);
      if (bad.length) problems.push(`${at}: characters/${name}/puppet.json: ${bad[0]}`);
      else rigs.set(name, rig);
    }
  });
  return { rigs, problems };
}

/** voice/visemes.json -> Map(line id -> [{ t, v }]). A missing or unreadable file gives an empty map. */
export function loadVisemes(dir) {
  const raw = readJson(path.join(dir, "voice", "visemes.json"));
  const out = new Map();
  for (const [id, events] of Object.entries(raw?.lines ?? {}))
    if (Array.isArray(events))
      out.set(
        id,
        events.filter((e) => e && Number.isFinite(e.t) && typeof e.v === "string"),
      );
  return out;
}
