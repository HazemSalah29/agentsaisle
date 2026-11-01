#!/usr/bin/env node
// /video doctor: lists which video tools are installed and which hardware tier that allows.
// Read-only. Runs only allow-listed programs with a fixed `--version` argument list (no shell), and for
// API keys it reports "found" or "missing" without ever reading or printing a value.
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

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
  "GOOGLE_API_KEY",
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

export function report({ tools, keys, platform }) {
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
  lines.push(`tier: ${hardwareTier(tools)}`);
  const todo = installLines(tools, platform);
  if (todo.length) lines.push("install:", ...todo);
  return lines.slice(0, MAX_LINES).join("\n");
}

function main() {
  const tools = Object.fromEntries(TOOLS.map((t) => [t.id, probe(t)]));
  const keys = Object.fromEntries(KEY_NAMES.map((k) => [k, Boolean(process.env[k])]));
  console.log(report({ tools, keys, platform: process.platform }));
  process.exit(hardwareTier(tools) === "not ready" ? 1 : 0);
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main();
