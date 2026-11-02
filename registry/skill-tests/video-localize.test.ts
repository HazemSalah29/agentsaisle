import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Item = { key: string; source: string; max: number | null; target: string };
type Doc = { from: string; to: string; dialect?: string; items: Item[] };
type Rec = {
  meta: Record<string, unknown>;
  voice: unknown;
  captions?: unknown;
  scenes: {
    props: {
      text?: string;
      items?: string[];
    };
  }[];
};
type Mod = {
  collectItems: (v: unknown, s: string) => Item[];
  translationProblems: (d: Doc, g?: unknown) => string[];
  parseGlossary: (t: string) => { brands: string[]; terms: { en: string; ar: string[] }[] };
  localizeVideo: (v: unknown, d: Doc) => Rec;
  localizeScript: (s: string, d: Doc) => string;
  dirOf: (l: string) => string;
};

const SCRIPT = "[l1] Rate limits protect a server.\n  beat: hook\n[l2] Three requests a second.\n";
const video = () => ({
  version: 1,
  script: "script.md",
  meta: { title: "Demo", type: "kids", format: "reel-9x16", fps: 30, lang: "en" },
  voice: { provider: "kokoro" },
  captions: { style: "clean" },
  scenes: [
    {
      id: "intro",
      kind: "title",
      narration: ["l1"],
      props: { text: "Rate limits", subtitle: "Why" },
    },
    { id: "items", kind: "list", narration: ["l2"], props: { items: ["One", "Two"] } },
  ],
});
const run = (...args: string[]) =>
  spawnSync("node", [skillFile("video-localize", "scripts/localize.mjs"), ...args], {
    encoding: "utf8",
  });

const fill = (doc: Doc) => {
  const ar: Record<string, string> = {
    "line:l1": "يحمي تحديد المعدل الخادم.",
    "line:l2": "ثلاثة طلبات في الثانية.",
    "scene:intro:text": "تحديد المعدل",
    "scene:intro:subtitle": "لماذا",
    "scene:items:items.0": "واحد",
    "scene:items:items.1": "اثنان",
  };
  doc.items.forEach((i) => (i.target = ar[i.key] ?? ""));
  return doc;
};

describe("localize", () => {
  it("lists every translatable string with its limit", async () => {
    const m = await loadScript<Mod>("video-localize", "scripts/localize.mjs");
    const items = m.collectItems(video(), SCRIPT);
    expect(items.map((i) => i.key)).toEqual([
      "line:l1",
      "line:l2",
      "scene:intro:text",
      "scene:intro:subtitle",
      "scene:items:items.0",
      "scene:items:items.1",
    ]);
    expect(items.find((i) => i.key === "scene:intro:text")?.max).toBe(120);
  });

  it("reports missing, long, digit, brand and glossary problems", async () => {
    const m = await loadScript<Mod>("video-localize", "scripts/localize.mjs");
    const g = m.parseGlossary(
      readFileSync(skillFile("video-localize", "assets/glossary.ar.yaml"), "utf8"),
    );
    expect(g.brands).toContain("Agent Aisle");
    expect(g.terms[0].ar.length).toBeGreaterThan(1);
    const doc: Doc = {
      from: "en",
      to: "ar",
      items: [
        { key: "line:a", source: "Agent Aisle", max: null, target: "ممر الوكلاء" },
        { key: "line:b", source: "Three", max: null, target: "٣ طلبات" },
        { key: "scene:s:text", source: "Hi", max: 3, target: "مرحبا بكم" },
        { key: "line:c", source: "The server", max: null, target: "الجهاز" },
        { key: "line:d", source: "x", max: null, target: "" },
      ],
    };
    const p = m.translationProblems(doc, g).join("\n");
    expect(p).toMatch(/line:a: brand/);
    expect(p).toMatch(/line:b: digits/);
    expect(p).toMatch(/scene:s:text: 9 characters, the limit is 3/);
    expect(p).toMatch(/line:c: "server" should be/);
    expect(p).toMatch(/line:d: no translation yet/);
    expect(
      m.translationProblems(
        fill({ from: "en", to: "ar", items: m.collectItems(video(), SCRIPT) }),
        g,
      ),
    ).toEqual([]);
  });

  it("sets language, direction and voice, and keeps the source untouched", async () => {
    const m = await loadScript<Mod>("video-localize", "scripts/localize.mjs");
    const src = video();
    const doc = fill({
      from: "en",
      to: "ar",
      dialect: "egyptian",
      items: m.collectItems(src, SCRIPT),
    });
    const out = m.localizeVideo(src, doc);
    expect(out.meta).toMatchObject({ lang: "ar", dir: "rtl" });
    expect(out.voice).toEqual({ provider: "3arab", voiceId: expect.stringContaining("مصرية") });
    expect(out.captions).toBeUndefined();
    expect(out.scenes[0].props.text).toBe("تحديد المعدل");
    expect(out.scenes[1].props.items).toEqual(["واحد", "اثنان"]);
    expect((src.scenes[0].props as { text: string }).text).toBe("Rate limits");
    expect(m.localizeVideo(src, doc)).toEqual(out); // repeatable
    const script = m.localizeScript(SCRIPT, doc);
    expect(script).toContain("[l1] يحمي تحديد المعدل الخادم.");
    expect(script).toContain("  beat: hook");
  });

  it("plans a sibling folder, refuses bad input and applies end to end", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "localize-"));
    const dir = path.join(root, "demo");
    spawnSync("mkdir", ["-p", dir]);
    writeFileSync(path.join(dir, "video.json"), JSON.stringify(video()));
    writeFileSync(path.join(dir, "script.md"), SCRIPT);
    expect(run("plan", dir, "--to", "fr").status).toBe(2);
    expect(run("plan", dir, "--to", "en").status).toBe(2);
    const p = run("plan", dir, "--to", "ar");
    expect(p.status, p.stderr).toBe(0);
    const dest = `${dir}.ar`;
    expect(run("plan", dir, "--to", "ar").status).toBe(2); // exists
    expect(run("apply", dest).status).toBe(1); // nothing translated yet
    const doc = JSON.parse(readFileSync(path.join(dest, "translate.json"), "utf8"));
    writeFileSync(path.join(dest, "translate.json"), JSON.stringify(fill(doc)));
    const a = run("apply", dest);
    expect(a.status, a.stdout + a.stderr).toBe(0);
    expect(JSON.parse(readFileSync(path.join(dest, "video.json"), "utf8")).meta.lang).toBe("ar");
    expect(readFileSync(path.join(dest, "translation-review.md"), "utf8")).toMatch(
      /machine-written draft/,
    );
    expect(JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8")).meta.lang).toBe("en");
    expect(existsSync(path.join(dest, "script.md"))).toBe(true);
  });

  it("refuses lip sync and voice cloning", () => {
    expect(run("plan", "x", "--lipsync").stderr).toMatch(/not built yet/);
    expect(run("plan", "x", "--keep-voice", "self").stderr).toMatch(/does not clone voices/);
  });
});

describe("the skill itself", () => {
  it("has no network or process code, a short SKILL.md and shared files that match their sources", () => {
    const meta = readFileSync(skillFile("video-localize", "skill.meta.yaml"), "utf8");
    expect(meta).toContain("network: false");
    expect(meta).toContain("needs_api_keys: []");
    expect(
      readFileSync(skillFile("video-localize", "SKILL.md"), "utf8").split("\n").length,
    ).toBeLessThanOrEqual(150);
    expect(readFileSync(skillFile("video-localize", "scripts/_lib.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "scripts/_lib.mjs"), "utf8"),
    );
    expect(readFileSync(skillFile("video-localize", "scripts/_script-parse.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-write", "scripts/script-parse.mjs"), "utf8"),
    );
    const dir = skillFile("video-localize", "scripts");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs"))) {
      const text = readFileSync(path.join(dir, f), "utf8");
      expect(text, f).not.toMatch(/\bfetch\s*\(|node:https?|node:net|\bcurl\b|\bwget\b/);
      expect(text, f).not.toMatch(/shell:\s*true|\beval\s*\(|new Function|node:child_process/);
    }
  });
});
