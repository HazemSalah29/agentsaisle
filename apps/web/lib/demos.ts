/** One demo video in docs/video/demos/index.json. */
export interface DemoEntry {
  id: string;
  title: string;
  type: string;
  route: string;
  summary: string;
  note: string;
  video: string;
  poster?: string;
  sources: string[];
}
export interface ComingEntry {
  id: string;
  title: string;
  why: string;
}
/** What the automatic check said about a rendered video, read from its qa/report.json. */
export interface QaSummary {
  ok: boolean;
  warnings: number;
  failures: number;
  seconds: number | null;
  size: string | null;
}
export interface DemoView extends DemoEntry {
  qa: QaSummary | null;
  /** Source files that exist, in index order. */
  files: string[];
}

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const FILE = /^[A-Za-z0-9._-]{1,64}$/;
const text = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : null);

/** Entries from the index file's text. Bad entries are dropped, never thrown on. Pure. */
export function parseIndex(raw: string): { demos: DemoEntry[]; coming: ComingEntry[] } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { demos: [], coming: [] };
  }
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const demos: DemoEntry[] = [];
  const seen = new Set<string>();
  for (const d of Array.isArray(obj.demos) ? obj.demos : []) {
    const r = (d ?? {}) as Record<string, unknown>;
    const id = text(r.id, 32);
    const title = text(r.title, 80);
    const video = text(r.video, 64);
    if (!id || !ID.test(id) || seen.has(id) || !title || !video || !FILE.test(video)) continue;
    seen.add(id);
    const poster = text(r.poster, 64);
    demos.push({
      id,
      title,
      type: text(r.type, 40) ?? "Video",
      route: text(r.route, 40) ?? "",
      summary: text(r.summary, 400) ?? "",
      note: text(r.note, 300) ?? "",
      video,
      ...(poster && FILE.test(poster) ? { poster } : {}),
      sources: (Array.isArray(r.sources) ? r.sources : []).filter(
        (s): s is string => typeof s === "string" && FILE.test(s),
      ),
    });
  }
  const coming: ComingEntry[] = [];
  for (const c of Array.isArray(obj.coming) ? obj.coming : []) {
    const r = (c ?? {}) as Record<string, unknown>;
    const id = text(r.id, 32);
    const title = text(r.title, 80);
    const why = text(r.why, 300);
    if (id && ID.test(id) && title && why) coming.push({ id, title, why });
  }
  return { demos, coming };
}

/** The pass/warn/fail counts of a QA report's text, or null when it is not one. Pure. */
export function summarizeQa(raw: string): QaSummary | null {
  let r: Record<string, unknown>;
  try {
    r = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!r || typeof r !== "object" || !Array.isArray(r.results)) return null;
  const levels = (r.results as Array<{ level?: unknown }>).map((x) => x?.level);
  const facts = (r.facts ?? {}) as Record<string, unknown>;
  const w = facts.width;
  const h = facts.height;
  return {
    ok: r.ok === true,
    warnings: levels.filter((l) => l === "warn").length,
    failures: levels.filter((l) => l === "fail").length,
    seconds: typeof facts.seconds === "number" ? facts.seconds : null,
    size: typeof w === "number" && typeof h === "number" ? `${w}x${h}` : null,
  };
}

/** Plain words for a QA summary. Only what the check found: it does not judge quality or taste. */
export function qaLabel(qa: QaSummary | null): string {
  if (!qa) return "No QA report";
  const w = qa.warnings;
  const base = qa.ok ? "QA passed" : "QA failed";
  return w ? `${base} with ${w} ${w === 1 ? "warning" : "warnings"}` : `${base}, no warnings`;
}
