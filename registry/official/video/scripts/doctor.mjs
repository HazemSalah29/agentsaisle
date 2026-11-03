#!/usr/bin/env node
// /video doctor: lists which video tools are installed and which hardware tier that allows.
// Read-only (with --cached it also keeps one small file, ~/.aisle-video/doctor-cache.json, so a studio that was
// checked in the last day prints one line instead of probing every tool again). Runs only allow-listed programs with a fixed `--version` argument list (no shell), and for
// API keys it reports "found" or "missing" without ever reading or printing a value.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MIN_NODE_MAJOR = 22;
export const MAX_LINES = 40;

/** Fixed programs and arguments. Nothing else is ever spawned. */
export const TOOLS = [
  {
    id: "node",
    cmd: "node",
    args: ["--version"],
    need: "core",
    why: "HyperFrames renders (Node 22+)",
  },
  {
    id: "ffmpeg",
    cmd: "ffmpeg",
    args: ["-version"],
    need: "core",
    why: "encoding, audio, every pipeline",
  },
  {
    id: "ffprobe",
    cmd: "ffprobe",
    args: ["-version"],
    need: "core",
    why: "QA checks (ships with FFmpeg)",
  },
  {
    id: "yt-dlp",
    cmd: "yt-dlp",
    args: ["--version"],
    need: "optional",
    why: "downloading footage with video-ingest (network)",
  },
  { id: "python", cmd: "python3", args: ["--version"], need: "optional", why: "TTS models, Manim" },
  { id: "manim", cmd: "manim", args: ["--version"], need: "optional", why: "maths scenes" },
  {
    id: "whisper",
    cmd: "whisper-cli",
    args: ["--help"],
    need: "optional",
    why: "captions from audio (whisper.cpp)",
  },
  { id: "nvidia-smi", cmd: "nvidia-smi", args: ["--version"], need: "gpu", why: "local GPU tier" },
];

/** Names only. The values of these variables are never read into the output. */
export const KEY_NAMES = [
  "ELEVENLABS_API_KEY",
  "KLING_API_KEY",
  "RUNWAY_API_KEY",
  "LUMA_API_KEY",
];

const INSTALL = {
  darwin: {
    node: "brew install node",
    ffmpeg: "brew install ffmpeg",
    ffprobe: "brew install ffmpeg",
    python: "brew install python",
  },
  win32: {
    node: "winget install OpenJS.NodeJS.LTS",
    ffmpeg: "winget install Gyan.FFmpeg",
    ffprobe: "winget install Gyan.FFmpeg",
    python: "winget install Python.Python.3.12",
  },
  linux: {
    node: "use your package manager (Node 22+)",
    ffmpeg: "use your package manager: ffmpeg",
    ffprobe: "use your package manager: ffmpeg",
    python: "use your package manager: python3",
  },
};

/** Pull the first x.y.z out of a tool's version output. */
export function parseVersion(text) {
  const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(text ?? "");
  return m ? { major: +m[1], minor: +m[2], text: m[0] } : null;
}

/** @param {Record<string, {found: boolean, version?: {major: number} | null}>} tools */
export function hardwareTier(tools) {
  const ok = (id) => tools[id]?.found;
  const nodeOk = ok("node") && (tools.node.version?.major ?? 0) >= MIN_NODE_MAJOR;
  if (!nodeOk || !ok("ffmpeg")) return "not ready";
  return ok("nvidia-smi") ? "local GPU" : "$0 laptop";
}

export function installLines(tools, platform) {
  const table = INSTALL[platform] ?? INSTALL.linux;
  const lines = [];
  for (const t of TOOLS.filter((x) => x.need === "core")) {
    const r = tools[t.id];
    const tooOld = t.id === "node" && r?.found && (r.version?.major ?? 0) < MIN_NODE_MAJOR;
    if (!r?.found || tooOld) lines.push(`  ${t.id}${tooOld ? " (too old)" : ""}: ${table[t.id]}`);
  }
  return [...new Set(lines)];
}

export function probe(tool, run = spawnSync) {
  const r = run(tool.cmd, tool.args, { encoding: "utf8", timeout: 10000, shell: false });
  if (r.error || r.status === null) return { found: false };
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { found: true, version: parseVersion(out.split("\n")[0]) };
}

export const MIN_PYTHON = [3, 10]; // Kokoro needs 3.10 to 3.12

/** The engine setup written when voice and caption engines were installed: ~/.aisle-video/tools.json. */
export function readToolsConfig(home = os.homedir()) {
  try {
    const cfg = JSON.parse(readFileSync(path.join(home, ".aisle-video", "tools.json"), "utf8"));
    return cfg && typeof cfg === "object" && !Array.isArray(cfg) ? cfg : {};
  } catch {
    return {};
  }
}

/** One line on the screen-capture library (the user's own install; only its package.json is read). */
export function captureLine(home = os.homedir(), exists = existsSync) {
  const pj = path.join(home, ".aisle-video", "node_modules", "playwright-core", "package.json");
  if (!exists(pj))
    return "  playwright  not installed (showcase capture: use your own screen recording instead)";
  try {
    const v = JSON.parse(readFileSync(pj, "utf8")).version;
    return `  playwright  ready${typeof v === "string" ? ` ${v}` : ""} (screen capture for showcase)`;
  } catch {
    return "  playwright  installed but unreadable";
  }
}

/**
 * One line per engine: ready, or what is missing and what happens without it. Only runs the configured
 * python with `--version` and a fixed import check, and whisper-cli with `--help`; never loads a model.
 * `cfg` is the tools.json content; `run` and `exists` are injectable for tests.
 */
export function engineLines(
  cfg,
  { run = spawnSync, exists = existsSync, home = os.homedir() } = {},
) {
  const ok = (cmd, args) => {
    const r = run(cmd, args, { encoding: "utf8", timeout: 20000, shell: false });
    return !r.error && r.status === 0 ? `${r.stdout ?? ""}${r.stderr ?? ""}` : null;
  };
  const lines = [];
  const py = typeof cfg.python === "string" && path.isAbsolute(cfg.python) ? cfg.python : null;
  const ver = py ? parseVersion(ok(py, ["--version"])?.split("\n")[0]) : null;
  const pyOk =
    ver &&
    (ver.major > MIN_PYTHON[0] || (ver.major === MIN_PYTHON[0] && ver.minor >= MIN_PYTHON[1]));
  lines.push(
    `  python venv ${pyOk ? `found ${ver.text}` : py ? "not usable (needs 3.10 to 3.12)" : "not set up (voice engines)"}`,
  );
  lines.push(
    `  kokoro      ${pyOk && ok(py, ["-c", "import kokoro"]) !== null ? "ready (English voice)" : "not installed (English voice: use --provider test or add audio yourself)"}`,
  );
  lines.push(
    `  opencv      ${pyOk && ok(py, ["-c", "import cv2"]) !== null ? "ready (face tracking for reframe)" : "not installed (reframe: use --mode center, left, right or x=0.4)"}`,
  );
  lines.push(
    `  3arab-tts   ${typeof cfg.arab3 === "string" && exists(cfg.arab3) && typeof cfg.arab3Model === "string" && exists(cfg.arab3Model) ? "set up (Arabic voice)" : "not set up (Arabic voice)"}`,
  );
  lines.push(captureLine(home, exists));
  const wc =
    typeof cfg["whisper-cli"] === "string" && path.isAbsolute(cfg["whisper-cli"])
      ? cfg["whisper-cli"]
      : null;
  const modelOk = typeof cfg.whisperModel === "string" && exists(cfg.whisperModel);
  lines.push(
    `  whisper.cpp ${wc && ok(wc, ["--help"]) !== null && modelOk ? `ready (${path.basename(cfg.whisperModel)})` : "not set up (captions use ESTIMATED word times)"}`,
  );
  return lines;
}

/** One line on the bundled code highlighter (part of video-core), so a missing install shows up early. */
export function sceneLines({
  exists = existsSync,
  root = path.join(path.dirname(realpathSync(fileURLToPath(import.meta.url))), "..", ".."),
} = {}) {
  const ok = exists(path.join(root, "video-core", "assets", "vendor", "shiki.mjs"));
  return [
    `  code scenes ${ok ? "ready (highlighter is bundled with video-core)" : "video-core not found next to this skill"}`,
  ];
}

export function report({ tools, keys, platform, engines = [] }) {
  const lines = ["video doctor"];
  for (const t of TOOLS) {
    const r = tools[t.id];
    const v = r.found ? `found ${r.version?.text ?? ""}`.trim() : "missing";
    lines.push(`  ${t.id.padEnd(11)} ${v}${t.need === "core" || r.found ? "" : " (optional)"}`);
  }
  const found = KEY_NAMES.filter((k) => keys[k]);
  lines.push(
    `  api keys    ${found.length ? `found: ${found.join(", ")}` : "none set (fine for the $0 tier)"}`,
  );
  lines.push(...engines);
  lines.push(`tier: ${hardwareTier(tools)}`);
  const todo = installLines(tools, platform);
  if (todo.length) lines.push("install:", ...todo);
  return lines.slice(0, MAX_LINES).join("\n");
}

export const CACHE_HOURS = 24;

/** The one-line answer from a cache file's contents, or null when it is missing, old, broken or "not ready". Pure. */
export function cachedLine(cache, now = Date.now()) {
  const at = Date.parse(cache?.at);
  if (!Number.isFinite(at) || typeof cache?.tier !== "string" || cache.tier === "not ready")
    return null;
  const hours = (now - at) / 3_600_000;
  if (hours < 0 || hours >= CACHE_HOURS) return null;
  return `doctor (cached, checked ${hours < 1 ? "under an hour" : `${Math.round(hours)} h`} ago): tier ${cache.tier}. Run doctor.mjs without --cached to see every tool.`;
}

function main() {
  const cacheFile = path.join(os.homedir(), ".aisle-video", "doctor-cache.json");
  const useCache = process.argv.includes("--cached");
  if (useCache) {
    let cache = null;
    try {
      cache = JSON.parse(readFileSync(cacheFile, "utf8"));
    } catch {
      /* no cache yet */
    }
    const line = cachedLine(cache);
    if (line) {
      console.log(line);
      process.exit(0);
    }
  }
  const tools = Object.fromEntries(TOOLS.map((t) => [t.id, probe(t)]));
  const keys = Object.fromEntries(KEY_NAMES.map((k) => [k, Boolean(process.env[k])]));
  console.log(
    report({
      tools,
      keys,
      platform: process.platform,
      engines: [...engineLines(readToolsConfig()), ...sceneLines()],
    }),
  );
  const tier = hardwareTier(tools);
  if (useCache && tier !== "not ready")
    try {
      mkdirSync(path.dirname(cacheFile), { recursive: true });
      writeFileSync(cacheFile, `${JSON.stringify({ at: new Date().toISOString(), tier })}\n`);
    } catch {
      /* a cache that cannot be written is only a missed shortcut */
    }
  process.exit(tier === "not ready" ? 1 : 0);
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main();
