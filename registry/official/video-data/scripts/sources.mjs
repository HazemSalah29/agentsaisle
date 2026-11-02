// Pure rules for video-data: which hosts and names may be fetched, how a fetch is made safely, and how an API
// answer becomes plain rows. Nothing here reads the environment or the disk; `fetchImpl` is injected so tests
// never touch the network. GET only, https only, no credentials, no redirects, a time limit and a size cap.

export const MAX_BYTES = 1024 * 1024;
export const TIMEOUT_MS = 15_000;
export const MAX_ITEMS = 8;
const DAY = 86_400_000;

const NPM_NAME = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;
const GH_NAME = /^[A-Za-z0-9_.-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/;
const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|\d{1,3}(\.\d{1,3}){3}|\[.*\]|.*:\d+)$|^(0x|0\d)/i;
export const SOURCES = ["npm", "github", "url"];
const UNSAFE = new RegExp("[\\p{Cc}\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "gu");
export const plain = (t, max) =>
  String(t ?? "")
    .replace(UNSAFE, " ")
    .replace(/[`*_<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Problems with a config, as readable strings. Pure. */
export function configProblems(c) {
  const out = [];
  if (!c || typeof c !== "object" || Array.isArray(c))
    return ["live.config.json must be an object"];
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(c.id ?? ""))
    out.push("id: lower-case letters, digits and hyphens");
  if (typeof c.title !== "string" || !c.title.trim() || c.title.length > 60)
    out.push("title: 1 to 60 characters");
  if (!SOURCES.includes(c.source)) out.push(`source: one of ${SOURCES.join(", ")}`);
  if (c.metric !== undefined && (typeof c.metric !== "string" || c.metric.length > 40))
    out.push("metric: up to 40 characters");
  if (c.unit !== undefined && (typeof c.unit !== "string" || c.unit.length > 12))
    out.push("unit: up to 12 characters");
  if (c.source === "npm" || c.source === "github") {
    const re = c.source === "npm" ? NPM_NAME : GH_NAME;
    const items = c.items;
    if (!Array.isArray(items) || items.length < 2 || items.length > 5)
      out.push(
        "items: a list of 2 to 5 " + (c.source === "npm" ? "package names" : "owner/repo names"),
      );
    else
      for (const i of items)
        if (
          typeof i !== "string" ||
          i.length > 214 ||
          !re.test(i) ||
          i.split("/").some((p) => p === "." || p === "..")
        )
          out.push(
            `items: "${plain(i, 30)}" is not a valid ${c.source === "npm" ? "package" : "owner/repo"} name`,
          );
  }
  if (c.source === "url") {
    const hosts = c.allowedHosts;
    if (
      !Array.isArray(hosts) ||
      !hosts.length ||
      hosts.length > 5 ||
      !hosts.every((h) => typeof h === "string" && /^[a-z0-9.-]+$/.test(h) && !PRIVATE_HOST.test(h))
    )
      out.push("allowedHosts: 1 to 5 host names you approve (no IPs, no localhost)");
    else out.push(...urlProblems(c.url, hosts));
    for (const k of ["labelField", "valueField"])
      if (typeof c[k] !== "string" || !c[k] || c[k].length > 40)
        out.push(`${k}: the column or key name`);
    if (
      c.previousField !== undefined &&
      (typeof c.previousField !== "string" || c.previousField.length > 40)
    )
      out.push("previousField: the column or key name");
  }
  if (
    c.format !== undefined &&
    !["reel-9x16", "short-9x16", "youtube-16x9", "square-1x1"].includes(c.format)
  )
    out.push("format: a known video format");
  return out;
}

/** Problems with a data URL: https, no credentials or port, an approved host, no private address. */
export function urlProblems(url, allowedHosts) {
  let u;
  try {
    u = new URL(String(url));
  } catch {
    return ["url: not a valid URL"];
  }
  if (u.protocol !== "https:") return ["url: only https is accepted"];
  if (u.username || u.password) return ["url: no credentials in the URL"];
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (u.port || PRIVATE_HOST.test(host)) return ["url: no ports, IP addresses or local hosts"];
  if (!allowedHosts.includes(host))
    return [`url: ${host} is not in allowedHosts (you approve hosts in live.config.json)`];
  return [];
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The request URLs for a config. Pure. */
export function requestUrls(c, now = Date.now()) {
  if (c.source === "npm") {
    const end = now - DAY; // yesterday: today is not complete
    return c.items.map(
      (p) => `https://api.npmjs.org/downloads/range/${iso(end - 13 * DAY)}:${iso(end)}/${p}`,
    );
  }
  if (c.source === "github")
    return c.items.flatMap((r) => [
      `https://api.github.com/repos/${r}`,
      `https://api.github.com/repos/${r}/releases/latest`,
    ]);
  return [c.url];
}

/** One GET with every limit applied. Returns { status, text }. */
export async function safeGet(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json, text/csv;q=0.8", "user-agent": "agentsaisle-video-data" },
  });
  const len = Number(res.headers?.get?.("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error(`${new URL(url).host} sent more than 1 MB; refusing it.`);
  let text;
  if (res.body?.getReader) {
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error(`${new URL(url).host} sent more than 1 MB; refusing it.`);
      }
      chunks.push(value);
    }
    text = Buffer.concat(chunks).toString("utf8");
  } else text = await res.text();
  return { status: res.status, text, type: String(res.headers?.get?.("content-type") ?? "") };
}

const json = (r, what) => {
  if (r.status === 403 || r.status === 429)
    throw new Error(
      `${what}: rate limited (HTTP ${r.status}). Try again later; nothing was worked around.`,
    );
  if (r.status === 404) throw new Error(`${what}: not found (HTTP 404). Check the name.`);
  if (r.status < 200 || r.status > 299) throw new Error(`${what}: HTTP ${r.status}.`);
  try {
    return JSON.parse(r.text);
  } catch {
    throw new Error(`${what}: the answer was not JSON.`);
  }
};

/** Minimal CSV: quoted fields, commas, no multi-line cells. Returns rows of objects keyed by the header. */
export function parseCsv(text) {
  const rows = String(text)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim());
  const cells = (l) => {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (q) {
        if (ch === '"' && l[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    return [...out, cur];
  };
  if (rows.length < 2) return [];
  const head = cells(rows[0]).map((h) => h.trim());
  return rows
    .slice(1, 501)
    .map((r) => Object.fromEntries(cells(r).map((v, i) => [head[i], v.trim()])));
}

/** Fetch and normalise: { id, source, urls, fetchedAt, asOf, metric, unit, items: [{label, value, previous?, detail?}] }. */
export async function fetchData(c, { fetchImpl = fetch, now = Date.now() } = {}) {
  const bad = configProblems(c);
  if (bad.length) throw new Error(`live.config.json: ${bad[0]}`);
  const urls = requestUrls(c, now);
  const base = {
    id: c.id,
    source: c.source,
    urls,
    fetchedAt: new Date(now).toISOString(),
    asOf: iso(now),
    metric: plain(c.metric ?? "", 40),
    unit: plain(c.unit ?? "", 12),
  };
  const items = [];
  if (c.source === "npm") {
    for (const [i, p] of c.items.entries()) {
      const body = json(await safeGet(urls[i], fetchImpl), `npm ${p}`);
      const days = Array.isArray(body?.downloads)
        ? body.downloads.filter(
            (d) => Number.isFinite(d?.downloads) && /^\d{4}-\d{2}-\d{2}$/.test(d?.day ?? ""),
          )
        : [];
      if (days.length < 14)
        throw new Error(`npm ${p}: fewer than 14 days of data; try again later.`);
      const last = days.slice(-14);
      const sum = (a) => a.reduce((t, d) => t + d.downloads, 0);
      items.push({
        label: plain(p, 40),
        value: sum(last.slice(7)),
        previous: sum(last.slice(0, 7)),
      });
      base.asOf = last[last.length - 1].day;
    }
    base.metric ||= "Weekly downloads";
  } else if (c.source === "github") {
    for (const [i, r] of c.items.entries()) {
      const repo = json(await safeGet(urls[i * 2], fetchImpl), `github ${r}`);
      if (!Number.isFinite(repo?.stargazers_count))
        throw new Error(`github ${r}: no star count in the answer.`);
      let detail;
      const rel = await safeGet(urls[i * 2 + 1], fetchImpl);
      if (rel.status === 200) {
        const tag = JSON.parse(rel.text)?.tag_name;
        if (typeof tag === "string") detail = `latest release ${plain(tag, 30)}`;
      }
      items.push({
        label: plain(r.split("/")[1], 40),
        value: repo.stargazers_count,
        ...(detail ? { detail } : {}),
      });
    }
    base.metric ||= "GitHub stars";
  } else {
    const r = await safeGet(urls[0], fetchImpl);
    if (r.status < 200 || r.status > 299)
      throw new Error(`${new URL(urls[0]).host}: HTTP ${r.status}.`);
    let rows;
    if (/json/i.test(r.type) || /^\s*[[{]/.test(r.text)) {
      const body = json(r, "data");
      rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
    } else if (/csv|text\/plain/i.test(r.type)) rows = parseCsv(r.text);
    else throw new Error(`${new URL(urls[0]).host}: only JSON and CSV answers are read.`);
    for (const row of rows) {
      const v = Number(row?.[c.valueField]);
      const label = plain(row?.[c.labelField], 40);
      if (!label || !Number.isFinite(v)) continue;
      const pv = c.previousField ? Number(row[c.previousField]) : NaN;
      items.push({ label, value: v, ...(Number.isFinite(pv) ? { previous: pv } : {}) });
    }
    base.metric ||= plain(c.valueField, 40);
  }
  items.sort((a, b) => b.value - a.value);
  if (items.length < 2) throw new Error("Fewer than 2 usable rows came back.");
  return { ...base, items: items.slice(0, MAX_ITEMS) };
}
