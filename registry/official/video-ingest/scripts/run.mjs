// The one place video scripts start other programs. Only allow-listed programs run, with an argument array
// (never a shell string), a timeout, and an environment with credential-looking variables removed.
// Importing this file runs nothing.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Programs the video skills may start. Add to this list only with the owner's approval. */
export const ALLOWED = Object.freeze([
  "ffmpeg",
  "ffprobe",
  "node",
  "python",
  "whisper-cli",
  "yt-dlp",
]);

/** Flags every yt-dlp call must carry: no user config, no --exec hooks, never a playlist. */
export const YTDLP_REQUIRED = Object.freeze(["--ignore-config", "--no-exec", "--no-playlist"]);

const SECRET_NAME = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH)/i;
const SCRIPT_FILE = /\.(mjs|cjs|js)$/;
const PY_FILE = /\.py$/;
const SKILL_NAME = /^video(-[a-z]+)*$/;

/** Folder that holds the skills (official/ in the repo, .claude/skills when installed), through symlinks. */
const skillsRoot = () =>
  path.resolve(path.dirname(realpathSync(fileURLToPath(import.meta.url))), "..", "..");

/** True when `file` is an absolute .py path inside one of our video skill folders. */
function isOurPython(file, root = skillsRoot()) {
  if (!path.isAbsolute(file) || !PY_FILE.test(file)) return false;
  const rel = path.relative(root, path.resolve(file));
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  return SKILL_NAME.test(rel.split(path.sep)[0]);
}

/** A copy of `env` without variables whose names look like credentials. */
export function scrubEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !SECRET_NAME.test(k)));
}

/** Throws when the call is not allowed. Exported so tests (and callers) can check without running. */
export function assertAllowed(cmd, args) {
  if (typeof cmd !== "string" || !ALLOWED.includes(cmd))
    throw new Error(
      `Refused: "${String(cmd).slice(0, 40)}" is not an allowed program (${ALLOWED.join(", ")}).`,
    );
  if (!Array.isArray(args) || args.some((a) => typeof a !== "string" || a.includes("\0")))
    throw new Error("Refused: arguments must be an array of strings.");
  if (cmd === "node") {
    const [script] = args;
    // `node -e`, `-p`, `--eval`, `--input-type` would run text instead of a file.
    if (!script || script.startsWith("-") || !SCRIPT_FILE.test(script) || !path.isAbsolute(script))
      throw new Error("Refused: node may only run an absolute path to a .mjs/.cjs/.js file.");
  }
  if (cmd === "yt-dlp") {
    // Only video-ingest has this copy. The URL comes last, after "--", so it can never be read as a flag.
    const n = args.length;
    const url = args[n - 1];
    if (!YTDLP_REQUIRED.every((f) => args.includes(f)) || args[n - 2] !== "--")
      throw new Error(`Refused: yt-dlp needs ${YTDLP_REQUIRED.join(" ")} and "--" before the URL.`);
    if (
      args
        .slice(0, -2)
        .some((a) => /^--(exec|cookies|config|plugin|netrc|username|password|downloader)/.test(a))
    )
      throw new Error("Refused: that yt-dlp option is not allowed.");
    if (!/^https:\/\//.test(url)) throw new Error("Refused: yt-dlp may only fetch https URLs.");
  }
  if (cmd === "python") {
    const [script] = args;
    // `python -c`, `-m` and relative paths would run text or an arbitrary module instead of our own file.
    if (!script || !isOurPython(script))
      throw new Error("Refused: python may only run a .py file inside a video skill folder.");
  }
}

/**
 * The program to start for a logical name. python and whisper-cli come from ~/.aisle-video/tools.json
 * (written when the engines are installed) when it names an absolute path with the right file name;
 * otherwise the plain name is looked up on PATH.
 */
export function resolveCommand(cmd, home = os.homedir()) {
  const fallback = { python: "python3" }[cmd] ?? cmd;
  if (cmd !== "python" && cmd !== "whisper-cli") return cmd;
  try {
    const file = path.join(home, ".aisle-video", "tools.json");
    if (!existsSync(file)) return fallback;
    const p = JSON.parse(readFileSync(file, "utf8"))?.[cmd];
    const ok = cmd === "python" ? /^python[\d.]*(\.exe)?$/ : /^whisper-cli(\.exe)?$/;
    return typeof p === "string" && path.isAbsolute(p) && ok.test(path.basename(p)) ? p : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Run an allowed program and wait for it. Returns { status, stdout, stderr, error }.
 * `spawn` is injectable for tests.
 */
export function run(cmd, args, { cwd, timeoutMs = 600_000, env, spawn = spawnSync, home } = {}) {
  assertAllowed(cmd, args);
  const r = spawn(resolveCommand(cmd, home), args, {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: scrubEnv(env ?? process.env),
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", error: r.error };
}
