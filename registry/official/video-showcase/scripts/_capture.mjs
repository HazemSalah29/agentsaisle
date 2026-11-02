// Rules and helpers for screen capture: which addresses may be recorded, where the browser library is looked
// for, and which targets are never typed into. Pure; opens nothing.
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
/** The version tested with; other versions only get a warning. TODO(verify) once installed with the owner's yes. */
export const PINNED_PLAYWRIGHT = "unset";
const SENSITIVE = /(pass(word|wd)?|secret|token|api[-_ ]?key|card|cvv|cvc|iban|ssn|pin\b)/i;

/**
 * The origin to record, or throws. Only http(s) to this machine is allowed unless `own` is set with a stated
 * rights basis (the owner's own site). Addresses with a user name or password are refused.
 */
export function checkUrl(raw, { own = false, rights = "" } = {}) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    throw new Error("--url must be a full address such as http://localhost:3000");
  }
  if (!["http:", "https:"].includes(u.protocol))
    throw new Error("--url must start with http:// or https://");
  if (u.username || u.password) throw new Error("--url must not contain a user name or password.");
  const local = LOCAL_HOSTS.includes(u.hostname);
  if (!local) {
    if (!own)
      throw new Error(
        `Refused ${u.hostname}: showcase records an app on this machine (localhost). For your own deployed site add --own-site and --rights "<why you may record it>".`,
      );
    if (String(rights).trim().length < 15)
      throw new Error(
        "--own-site needs --rights with at least 15 characters (why you may record this site).",
      );
  }
  return {
    origin: u.origin,
    local,
    rights: local ? "own work (recorded from a local app)" : String(rights).trim().slice(0, 200),
  };
}

/** True when a target looks like a secret field; showcase never types into those (use dummy data on a normal field). */
export const sensitiveTarget = (step) => SENSITIVE.test(`${step.css ?? ""} ${step.text ?? ""}`);

/** Where playwright-core is installed for the studio: ~/.aisle-video/node_modules. Returns { entry, version } or null. */
export function resolvePlaywright(home = os.homedir(), { exists = existsSync, readJson } = {}) {
  const read = readJson ?? ((f) => JSON.parse(readFileSync(f, "utf8")));
  for (const name of ["playwright-core", "playwright"]) {
    const dir = path.join(home, ".aisle-video", "node_modules", name);
    const pj = path.join(dir, "package.json");
    if (!exists(pj)) continue;
    try {
      const p = read(pj);
      if (p.name !== name || typeof p.version !== "string") continue;
      const main = typeof p.main === "string" ? p.main : "index.js";
      return { entry: path.resolve(dir, main), version: p.version };
    } catch {
      /* try the next one */
    }
  }
  return null;
}

export const entryUrl = (entry) => pathToFileURL(entry).href;

/** "1280x720" to { w, h }. */
export function parseViewport(v = "1280x720") {
  const m = /^(\d{3,4})x(\d{3,4})$/.exec(v);
  if (!m) throw new Error("--viewport must look like 1280x720");
  const [w, h] = [Number(m[1]), Number(m[2])];
  if (w < 320 || h < 320 || w > 3000 || h > 3000)
    throw new Error("--viewport must be 320 to 3000 pixels each way");
  return { w, h };
}
