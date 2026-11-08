import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skillFile } from "./load";

const skill = (rel: string) => skillFile("arch-visualize", rel);
const read = (rel: string) => readFileSync(skill(rel), "utf8");
const node = (script: string, args: string[]) =>
  spawnSync(process.execPath, [skill(`scripts/${script}`), ...args], { encoding: "utf8" });
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "av-rel-"));
const CANARY = "CANARY-SECRET-DO-NOT-READ";

describe("arch-visualize release: SKILL.md", () => {
  const md = read("SKILL.md");
  it("stays within 150 lines and names the version in its metadata", () => {
    expect(md.split("\n").length).toBeLessThanOrEqual(150);
    expect(read("skill.meta.yaml")).toMatch(/^version: 0\.3\.0$/m);
  });
  it("only names scripts and references that exist", () => {
    for (const m of md.matchAll(/scripts\/([\w-]+\.mjs)/g))
      expect(existsSync(skill(`scripts/${m[1]}`)), m[1]).toBe(true);
    for (const m of md.matchAll(/references\/([\w-]+\.md)/g))
      expect(existsSync(skill(`references/${m[1]}`)), m[1]).toBe(true);
  });
  it("tells the agent to settle candidates, keep facts evidenced, simulate and offer Changes", () => {
    expect(md).toMatch(/Settle every candidate/);
    expect(md).toMatch(/only where a file shows it/);
    expect(md).toMatch(/simulate\.mjs/);
    expect(md).toMatch(/architecture\.base\.json/);
    expect(md).toMatch(/--diff docs\/architecture\.diff\.json/);
    expect(md).toMatch(/machine draft/);
  });
  it("tells the agent how to go inside a component, within limits, and to drop risks outside the model", () => {
    expect(md).toMatch(/code-map\.mjs --root \. --model docs\/architecture\.json --attach/);
    expect(md).toMatch(/--focus/);
    expect(md).toMatch(/model-check with `--root \.`/);
    expect(md).toMatch(/"docBy": "agent"/);
    expect(md).toMatch(/at most 30 per node/);
    expect(md).toMatch(/references\/inside\.md/);
    expect(md).toMatch(/`nodes: \[\]` is about code outside the model/);
    // the steps stay numbered one to eleven, in order
    const nums = [...md.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it("describes only what the inside view really does, in the installed reference", () => {
    const ref = read("references/inside.md");
    for (const flag of ["--attach", "--dir", "--focus", "--depth", "--max-symbols", "--out"])
      expect(ref, flag).toContain(flag);
    expect(ref).toMatch(/never runs or imports project code/);
    expect(ref).toMatch(/at most 30 per component/i);
    expect(ref).toMatch(/Python, Go, Elixir, Haskell/);
    // every flag the reference names is one the script accepts
    const src = read("scripts/code-map.mjs");
    for (const m of ref.matchAll(/`(--[a-z-]+)/g))
      expect(src, m[1]).toContain(`"${m[1]!.slice(2)}"`);
  });
  it("makes no comparison with other tools in any installed file", () => {
    const installed = [
      "SKILL.md",
      ...readdirSync(skill("references")).map((f) => `references/${f}`),
    ];
    for (const f of installed) expect(read(f), f).not.toMatch(/\bbetter than\b|archify|\bbeats\b/i);
  });
});

describe("arch-visualize release: pages", () => {
  const model = skill("evals/fixture-model-v2.json");
  const dir = tmp();
  const diffFile = path.join(dir, "d.json");
  expect(
    node("diff.mjs", [
      "--base",
      skill("evals/fixture-model-base.json"),
      "--head",
      model,
      "--out",
      diffFile,
    ]).status,
  ).toBe(0);
  const page = (lang: string, out: string) => {
    const r = node("render.mjs", [
      "--model",
      model,
      "--diff",
      diffFile,
      "--lang",
      lang,
      "--out",
      out,
      "--force",
    ]);
    expect(r.status, r.stderr).toBe(0);
    return readFileSync(out, "utf8");
  };

  it.each(["en", "ar"])("renders the same bytes twice (%s)", (lang) => {
    expect(page(lang, path.join(dir, `a-${lang}.html`))).toBe(
      page(lang, path.join(dir, `b-${lang}.html`)),
    );
  });

  it("makes no network or dynamic-code calls outside the embedded data", () => {
    const html = page("en", path.join(dir, "o.html"))
      .replace(/<script type="application\/json"[^>]*>[\s\S]*?<\/script>/g, "")
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/g, "");
    expect(html).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|\bimport\s*\(|<link\b|\/\/cdn/i);
    // the only URLs allowed are XML namespaces
    const urls = [...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]);
    for (const u of urls) expect(u, u).toMatch(/^http:\/\/www\.w3\.org\//);
  });

  it("never shows the secret canary in any output of the chain", () => {
    const root = skill("evals/fixture-app");
    const outs: string[] = [];
    const draft = path.join(dir, "draft.json");
    const d = node("discover.mjs", ["--root", root, "--out", draft]);
    outs.push(d.stdout, d.stderr, readFileSync(draft, "utf8"));
    const sarif = path.join(dir, "r.sarif");
    const r = node("risk-check.mjs", [
      "--model",
      model,
      "--root",
      root,
      "--format",
      "sarif",
      "--out",
      sarif,
    ]);
    outs.push(r.stdout, r.stderr, readFileSync(sarif, "utf8"));
    const s = node("simulate.mjs", ["--model", model, "--down", "cache"]);
    outs.push(
      s.stdout,
      s.stderr,
      readFileSync(diffFile, "utf8"),
      page("en", path.join(dir, "c.html")),
    );
    for (const o of outs) expect(o).not.toContain(CANARY);
  });
});
