// Pure rules for video-ingest: the rights basis, the URL and host checks, the yt-dlp argument list and the
// rights-ledger entries. Nothing here touches the network, the disk or another program.
import { createHash } from "node:crypto";

export const RIGHTS = Object.freeze(["own", "permission", "cc", "public-domain"]);
export const NOTE_MIN = 15;
export const MAX_BYTES = 500 * 1024 * 1024;
export const MEDIA_EXT = /\.(mp4|webm|mov|mkv|mp3|wav|m4a|png|jpe?g|webp)$/i;
const ID = /^[a-z][a-z0-9-]{0,31}$/;

/** Short licence text for video.json (max 80 characters); the full note lives in the ledger. */
const LICENCE = {
  own: "own work (see rights-ledger.json)",
  permission: "permission granted (see rights-ledger.json)",
  cc: "Creative Commons (see rights-ledger.json)",
  "public-domain": "public domain (see rights-ledger.json)",
};

/** Returns a list of problems with the stated rights basis; empty means it is acceptable. */
export function rightsProblems({ rights, note }) {
  if (!rights) return [`--rights is required: one of ${RIGHTS.join(", ")}.`];
  if (!RIGHTS.includes(rights))
    return [
      `--rights "${String(rights).slice(0, 30)}" is not accepted (use ${RIGHTS.join(", ")}). Without a rights basis nothing is downloaded.`,
    ];
  if (rights !== "own" && String(note ?? "").trim().length < NOTE_MIN)
    return [
      `--rights ${rights} needs --source-note of at least ${NOTE_MIN} characters: the licence name and link, or who gave permission.`,
    ];
  return [];
}

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|\d{1,3}(\.\d{1,3}){3}|\[.*\]|.*:\d+)$|^(0x|0\d)/i;

/** Problems with a URL: https only, no credentials, no private or numeric hosts, no blocked service. */
export function urlProblems(raw, blocked = []) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return ["That is not a valid URL."];
  }
  if (u.protocol !== "https:") return ["Only https URLs are accepted."];
  if (u.username || u.password) return ["URLs with a user name or password are refused."];
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (u.port || PRIVATE_HOST.test(host))
    return ["Local, numeric and custom-port addresses are refused."];
  const hit = blocked.find((b) => host === b || host.endsWith(`.${b}`));
  if (hit)
    return [
      `${hit} is a paid, DRM-protected or login-only service; nothing is downloaded from it.`,
    ];
  return [];
}

/** The fixed yt-dlp argument list. The URL is last, after "--". TODO(verify): flags against current yt-dlp docs. */
export function ytdlpArgs({ url, outTemplate }) {
  return [
    "--ignore-config",
    "--no-exec",
    "--no-playlist",
    "--no-mtime",
    "--no-warnings",
    "--restrict-filenames",
    "--max-filesize",
    "500M",
    "-f",
    "bv*[height<=1080]+ba/b[height<=1080]/b",
    "--merge-output-format",
    "mp4",
    "-o",
    outTemplate,
    "--",
    url,
  ];
}

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Asset ids must match the video.json schema. */
export const validId = (id) => typeof id === "string" && ID.test(id);

/** The next free `clip-N` id given the ids already used. */
export function nextId(used) {
  for (let n = 1; ; n++) if (!used.has(`clip-${n}`)) return `clip-${n}`;
}

const KIND = (file) =>
  /\.(png|jpe?g|webp)$/i.test(file) ? "image" : /\.(mp3|wav|m4a)$/i.test(file) ? "audio" : "video";

/** One ledger row. `date` is an ISO string passed in so tests are deterministic. */
export function ledgerEntry({
  id,
  rights,
  note,
  source,
  file,
  bytes,
  hash,
  tool,
  date,
  analysisOnly,
}) {
  return {
    id,
    rights,
    note: String(note ?? "").trim(),
    source,
    file,
    bytes,
    sha256: hash,
    tool,
    date,
    analysisOnly: analysisOnly === true,
  };
}

/** The video.json asset for a ledger entry. */
export function assetFor(entry, { fromUrl }) {
  return {
    id: entry.id,
    path: entry.file,
    kind: KIND(entry.file),
    source: fromUrl ? "download" : "user",
    licence: LICENCE[entry.rights],
    ...(entry.rights === "cc" || entry.rights === "permission"
      ? { attribution: entry.note.slice(0, 300) }
      : {}),
    ...(entry.analysisOnly ? { analysisOnly: true } : {}),
  };
}

/** Compare ledger rows with the files on disk. `readHash(file)` returns a hash or null when missing. */
export function verifyLedger(rows, readHash) {
  const problems = [];
  for (const r of rows) {
    const h = readHash(r.file);
    if (h === null) problems.push(`${r.id}: file ${r.file} is missing`);
    else if (h !== r.sha256) problems.push(`${r.id}: file ${r.file} changed since it was recorded`);
  }
  return problems;
}
