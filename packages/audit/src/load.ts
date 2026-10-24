import { lstat, open, readdir, readlink, realpath } from "node:fs/promises";
import path from "node:path";
import type { FileKind, LoadedSkill, SkillFile, SymlinkInfo } from "./types.js";

export const LIMITS = {
  maxFiles: 2000,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
} as const;

/** The audit could not run (bad input or a limit was hit). The CLI maps this to exit code 2. */
export class AuditInputError extends Error {
  override name = "AuditInputError";
}

export interface LoadOptions {
  /** Also read files the CLI never installs (evals/, preview/, root README.md, SKILL.src.md). */
  includeUninstalled?: boolean;
}

const SKIP_DIRS = new Set([".git", "node_modules/.cache"]);
const IGNORED_HIDDEN = new Set([".DS_Store", ".gitkeep"]);
export const SUPPRESSION_FILE = ".aisleaudit.yaml";

const SCRIPT_EXT = new Set([
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".mts",
  ".cts",
  ".tsx",
  ".py",
  ".rb",
  ".pl",
  ".php",
  ".ps1",
  ".psm1",
  ".bat",
  ".cmd",
  ".lua",
]);
const INSTRUCTION_EXT = new Set([".md", ".mdx", ".markdown", ".txt", ".rst"]);
const EXEC_BINARY_EXT = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".class",
  ".jar",
  ".pyc",
  ".pyo",
  ".o",
  ".a",
  ".wasm",
  ".msi",
  ".bin",
  ".node",
  ".app",
]);
const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".bmp",
  ".tiff",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".pdf",
  ".mp3",
  ".mp4",
  ".mov",
  ".webm",
  ".wav",
  ".ogg",
  ".zip",
  ".gz",
  ".tar",
  ".tgz",
  ".xz",
  ".7z",
  ".bz2",
]);

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function hasExecMagic(b: Buffer): boolean {
  if (b.length < 4) return false;
  const [a, c, d, e] = [b[0], b[1], b[2], b[3]];
  if (a === 0x7f && c === 0x45 && d === 0x4c && e === 0x46) return true; // ELF
  if (a === 0xfe && c === 0xed && d === 0xfa && (e === 0xce || e === 0xcf)) return true; // Mach-O
  if ((a === 0xce || a === 0xcf) && c === 0xfa && d === 0xed && e === 0xfe) return true; // Mach-O LE
  if (a === 0xca && c === 0xfe && d === 0xba && e === 0xbe) return true; // fat Mach-O / Java class
  if (a === 0x00 && c === 0x61 && d === 0x73 && e === 0x6d) return true; // wasm
  if (a === 0x4d && c === 0x5a) {
    // "MZ": only a PE executable if it also looks binary.
    return b.subarray(0, Math.min(b.length, 1024)).includes(0);
  }
  return false;
}

function hasNul(b: Buffer): boolean {
  return b.subarray(0, Math.min(b.length, 8000)).includes(0);
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}

/** Per-line fence state for markdown-like files. */
function fenceState(lines: string[]): { fenced: boolean[]; info: string[] } {
  const fenced: boolean[] = [];
  const info: string[] = [];
  let open: { ch: string; len: number; info: string } | undefined;
  for (const line of lines) {
    const m = /^ {0,3}(`{3,}|~{3,})\s*(.*)$/.exec(line);
    if (open) {
      if (m && m[1]![0] === open.ch && m[1]!.length >= open.len && (m[2] ?? "").trim() === "") {
        open = undefined;
        fenced.push(false);
        info.push("");
      } else {
        fenced.push(true);
        info.push(open.info);
      }
    } else if (m) {
      open = { ch: m[1]![0]!, len: m[1]!.length, info: (m[2] ?? "").trim() };
      fenced.push(false);
      info.push("");
    } else {
      fenced.push(false);
      info.push("");
    }
  }
  return { fenced, info };
}

function classify(rel: string, ext: string, text: string, mode: number): FileKind {
  if (rel === "SKILL.md") return "skill-md";
  if (INSTRUCTION_EXT.has(ext)) return "instruction";
  if (SCRIPT_EXT.has(ext) || rel.startsWith("scripts/")) return "script";
  if (text.startsWith("#!") || (mode & 0o111) !== 0) return "script";
  return "other";
}

function isUninstalled(rel: string): boolean {
  return (
    rel === "README.md" ||
    rel === "SKILL.src.md" ||
    rel === "evals" ||
    rel.startsWith("evals/") ||
    rel === "preview" ||
    rel.startsWith("preview/")
  );
}

export async function loadSkill(folder: string, options: LoadOptions = {}): Promise<LoadedSkill> {
  let root: string;
  try {
    root = await realpath(folder);
    const st = await lstat(root);
    if (!st.isDirectory()) throw new Error("not a directory");
  } catch {
    throw new AuditInputError(`Not a readable folder: ${folder}`);
  }

  const files: SkillFile[] = [];
  const symlinks: SymlinkInfo[] = [];
  const hidden: string[] = [];
  let suppressionFile: string | undefined;
  let totalBytes = 0;
  let count = 0;

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = toPosix(path.relative(root, abs));
      if (SKIP_DIRS.has(entry.name) && entry.isDirectory()) continue;
      if (!options.includeUninstalled && isUninstalled(rel)) continue;

      const st = await lstat(abs);
      if (st.isSymbolicLink()) {
        const target = await readlink(abs);
        const resolved = path.resolve(path.dirname(abs), target);
        const escapes = path.relative(root, resolved).startsWith("..") || path.isAbsolute(target);
        symlinks.push({ path: rel, target, escapes });
        continue;
      }

      const isHidden = entry.name.startsWith(".") && !IGNORED_HIDDEN.has(entry.name);
      if (isHidden && entry.name !== SUPPRESSION_FILE) {
        // Report the topmost hidden entry once.
        if (!hidden.some((h) => rel.startsWith(h + "/"))) hidden.push(rel);
      }

      if (st.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!st.isFile()) continue;

      count++;
      if (count > LIMITS.maxFiles) {
        throw new AuditInputError(`Too many files (limit ${LIMITS.maxFiles}).`);
      }
      if (st.size > LIMITS.maxFileBytes) {
        throw new AuditInputError(`${rel} is larger than ${LIMITS.maxFileBytes / 1024 / 1024} MB.`);
      }
      totalBytes += st.size;
      if (totalBytes > LIMITS.maxTotalBytes) {
        throw new AuditInputError(`Skill is larger than ${LIMITS.maxTotalBytes / 1024 / 1024} MB.`);
      }

      // Read bytes only; the content is never imported, required or executed.
      const handle = await open(abs, "r");
      let buf: Buffer;
      try {
        buf = Buffer.alloc(st.size);
        let off = 0;
        while (off < st.size) {
          const { bytesRead } = await handle.read(buf, off, st.size - off, off);
          if (bytesRead === 0) break;
          off += bytesRead;
        }
      } finally {
        await handle.close();
      }

      const ext = path.extname(entry.name).toLowerCase();

      if (rel === SUPPRESSION_FILE) {
        suppressionFile = buf.toString("utf8");
        continue;
      }

      const execBinary = EXEC_BINARY_EXT.has(ext) || hasExecMagic(buf);
      if (execBinary || BINARY_EXT.has(ext) || hasNul(buf)) {
        files.push({
          path: rel,
          kind: "binary",
          bytes: st.size,
          executable: execBinary,
          lines: [],
          fenced: [],
          fenceInfo: [],
        });
        continue;
      }

      // Decoding keeps a leading BOM as U+FEFF so U04 can see it.
      const text = buf.toString("utf8");
      const lines = splitLines(text);
      const kind = classify(rel, ext, text, st.mode);
      const md = kind === "skill-md" || kind === "instruction";
      const fs = md ? fenceState(lines) : undefined;
      files.push({
        path: rel,
        kind,
        bytes: st.size,
        text,
        lines,
        fenced: fs?.fenced ?? lines.map(() => false),
        fenceInfo: fs?.info ?? lines.map(() => ""),
      });
    }
  }

  await walk(root);
  return { root, files, symlinks, hidden, suppressionFile, totalBytes };
}
