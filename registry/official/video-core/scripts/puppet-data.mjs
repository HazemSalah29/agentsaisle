// Reads the files a puppet scene needs from the project folder: each character's rig
// (characters/<name>/puppet.json) and the mouth shapes made from the voice (voice/visemes.json).
// Text only: nothing in these files is ever run.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { rigProblems } from "../assets/puppet/rig.mjs";
import { rig3dProblems } from "../assets/puppet/rig3d.mjs";

const readJson = (f) => {
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};

/**
 * Rigs of every character used in puppet scenes: { rigs: Map(name -> flat rig), rigs3d: Map(name -> 3D rig), problems }.
 * A scene with look "3d" needs characters/<name>/puppet3d.json; any other needs puppet.json.
 */
export function loadRigs(video, dir) {
  const rigs = new Map();
  const rigs3d = new Map();
  const problems = [];
  video.scenes.forEach((s, i) => {
    if (s?.kind !== "puppet") return;
    for (const [k, c] of (s.props?.cast ?? []).entries()) {
      const name = c?.rig;
      const three = s.props?.look === "3d";
      const map = three ? rigs3d : rigs;
      if (typeof name !== "string" || !/^[a-z][a-z0-9-]{0,31}$/.test(name) || map.has(name))
        continue;
      const at = `$.scenes[${i}].props.cast[${k}].rig`;
      const fname = three ? "puppet3d.json" : "puppet.json";
      const file = path.join(dir, "characters", name, fname);
      if (!existsSync(file)) {
        problems.push(`${at}: characters/${name}/${fname} is missing (video-kids makes it)`);
        continue;
      }
      const rig = readJson(file);
      const bad = three ? rig3dProblems(rig) : rigProblems(rig);
      if (bad.length) problems.push(`${at}: characters/${name}/${fname}: ${bad[0]}`);
      else map.set(name, rig);
    }
  });
  return { rigs, rigs3d, problems };
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
