import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseIndex, summarizeQa } from "./demos";
import type { ComingEntry, DemoView, QaSummary } from "./demos";

/** Default place of the demos in the repository, from the web app's folder. */
export const DEMOS_DIR = path.resolve(process.cwd(), "../../docs/video/demos");

/** The demos whose video file exists, each with its QA summary and the source files that exist. Never throws. */
export function loadDemos(dir = DEMOS_DIR): {
  demos: DemoView[];
  coming: ComingEntry[];
} {
  let raw: string;
  try {
    raw = readFileSync(path.join(dir, "index.json"), "utf8");
  } catch {
    return { demos: [], coming: [] };
  }
  const { demos, coming } = parseIndex(raw);
  const views: DemoView[] = [];
  for (const d of demos) {
    const folder = path.join(dir, d.id);
    if (!existsSync(path.join(folder, d.video))) continue;
    let qa: QaSummary | null;
    try {
      qa = summarizeQa(readFileSync(path.join(folder, "qa", "report.json"), "utf8"));
    } catch {
      qa = null;
    }
    views.push({ ...d, qa, files: d.sources.filter((s) => existsSync(path.join(folder, s))) });
  }
  return { demos: views, coming };
}
