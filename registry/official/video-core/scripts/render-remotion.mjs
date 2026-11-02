// The Remotion side of render.mjs: finding an installed Remotion, its command line, and the licence note.
// Remotion is never installed or downloaded here. Importing this file runs nothing.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Remotion is versioned as one set: `remotion` and `@remotion/cli` must be the same version. */
export const SUPPORTED_MAJOR = 4;
export const REMOTION_LICENCE_NOTE =
  "Remotion has its own licence: free for individuals and companies of up to 3 people, a paid company licence above that (TODO(verify) current terms: remotion.dev/license). HyperFrames (Apache 2.0) has no such limit.";

const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
const readdirSafe = (d) => {
  try {
    return readdirSync(d).sort();
  } catch {
    return [];
  }
};

/** { bin, version } for a `@remotion/cli` package folder whose `remotion` sibling has the same version, else null. */
export function binOfRemotion(cliDir, fs = { exists: existsSync, readJson }) {
  const pj = path.join(cliDir, "package.json");
  if (!fs.exists(pj)) return null;
  try {
    const p = fs.readJson(pj);
    if (p.name !== "@remotion/cli") return null;
    const bin =
      typeof p.bin === "string" ? p.bin : (p.bin?.remotion ?? Object.values(p.bin ?? {})[0]);
    if (!bin) return null;
    const corePj = path.join(cliDir, "..", "..", "remotion", "package.json");
    const core = fs.exists(corePj) ? fs.readJson(corePj) : null;
    return {
      bin: path.resolve(cliDir, bin),
      version: p.version,
      core: core?.name === "remotion" ? core.version : null,
    };
  } catch {
    return null;
  }
}

/** Where `@remotion/cli` might be, best first: --remotion, node_modules next to the project (and three above), global. */
export function remotionCandidates({
  explicit,
  dir,
  execPath = process.execPath,
  home = os.homedir(),
  list = readdirSafe,
}) {
  const out = [];
  if (explicit) out.push(path.resolve(explicit));
  let d = path.resolve(dir);
  for (let i = 0; i < 4; i++) {
    out.push(path.join(d, "node_modules", "@remotion", "cli"));
    d = path.dirname(d);
  }
  const prefix = path.resolve(path.dirname(execPath), "..");
  out.push(
    path.join(prefix, "lib", "node_modules", "@remotion", "cli"),
    path.join(path.dirname(execPath), "node_modules", "@remotion", "cli"),
  );
  const npx = path.join(home, ".npm", "_npx");
  for (const e of list(npx)) out.push(path.join(npx, e, "node_modules", "@remotion", "cli"));
  return out;
}

export function findRemotion(opts, fs) {
  for (const c of remotionCandidates(opts)) {
    const found = binOfRemotion(c, fs);
    if (found) return found;
  }
  return null;
}

/** Problems that stop a render with this install: wrong major, or `remotion` and the CLI out of step. */
export function remotionProblems(found) {
  const major = Number(String(found.version).split(".")[0]);
  const out = [];
  if (major !== SUPPORTED_MAJOR)
    out.push(
      `Remotion ${found.version} found; this skill supports major version ${SUPPORTED_MAJOR}. Install remotion and @remotion/cli at one 4.x version.`,
    );
  if (found.core && found.core !== found.version)
    out.push(`remotion ${found.core} and @remotion/cli ${found.version} must be the same version.`);
  if (!found.core)
    out.push(
      "The `remotion` package was not found next to @remotion/cli; install both at the same version.",
    );
  return out;
}

/**
 * Arguments for `remotion render`. The audio is never rendered here (--muted): ffmpeg mixes the voice and music.
 * TODO(verify): flag names against the current Remotion CLI docs.
 */
export function remotionArgs({ bin, out, draft }) {
  return [
    bin,
    "render",
    "src/index.ts",
    "main",
    out,
    "--public-dir=public",
    "--codec=h264",
    "--muted",
    "--log=error",
    ...(draft ? ["--scale=0.5", "--crf=32"] : []),
  ];
}
