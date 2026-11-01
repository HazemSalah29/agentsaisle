// The one place video scripts start other programs. Only allow-listed programs run, with an argument array
// (never a shell string), a timeout, and an environment with credential-looking variables removed.
// Importing this file runs nothing.
import { spawnSync } from "node:child_process";
import path from "node:path";

/** Programs the video skills may start. Add to this list only with the owner's approval. */
export const ALLOWED = Object.freeze(["ffmpeg", "ffprobe", "node"]);

const SECRET_NAME = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH)/i;
const SCRIPT_FILE = /\.(mjs|cjs|js)$/;

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
}

/**
 * Run an allowed program and wait for it. Returns { status, stdout, stderr, error }.
 * `spawn` is injectable for tests.
 */
export function run(cmd, args, { cwd, timeoutMs = 600_000, env, spawn = spawnSync } = {}) {
  assertAllowed(cmd, args);
  const r = spawn(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: scrubEnv(env ?? process.env),
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", error: r.error };
}
