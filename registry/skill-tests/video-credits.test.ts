import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Credits = {
  computeDisclosure: (v: any) => {
    realisticSynthetic: boolean;
    aiMusic: boolean;
    voiceClone: string;
  };
  buildCredits: (v: any) => { ok: boolean; problems: string[]; credits: any };
  creditsText: (c: any) => string;
};
const load = () => loadScript<Credits>("video-core", "scripts/credits.mjs");

const project = (extra: Record<string, unknown> = {}) => ({
  version: 1,
  meta: { title: "Demo", type: "explainer", format: "reel-9x16", fps: 30, lang: "en" },
  scenes: [{ id: "s1", kind: "title", durationFrom: "fixed", seconds: 2, props: { text: "x" } }],
  ...extra,
});
const asset = (o: Record<string, unknown>) => ({
  id: "a",
  path: "assets/a.png",
  source: "user",
  licence: "own",
  ...o,
});

describe("video-core credits", () => {
  it("says nothing is needed when no asset is AI-generated", async () => {
    const { buildCredits } = await load();
    const r = buildCredits(project({ assets: [asset({ kind: "image" })] }));
    expect(r.ok).toBe(true);
    expect(r.credits.disclosure).toEqual({
      realisticSynthetic: false,
      aiMusic: false,
      voiceClone: "none",
    });
    expect(r.credits.guidance[0]).toMatch(/No synthetic-content label needed: no AI-generated/);
  });

  it("flags realistic AI visuals, but not stylised ones", async () => {
    const { computeDisclosure, buildCredits } = await load();
    const real = project({
      assets: [asset({ kind: "image", aiGenerated: true, realistic: true })],
    });
    const styled = project({ assets: [asset({ kind: "image", aiGenerated: true })] });
    expect(computeDisclosure(real).realisticSynthetic).toBe(true);
    expect(computeDisclosure(styled).realisticSynthetic).toBe(false);
    expect(buildCredits(styled).credits.guidance[0]).toMatch(/stylised, not realistic/);
    expect(buildCredits(real).credits.guidance[0]).toMatch(/Turn on the altered or synthetic/);
  });

  it("flags AI music only for the music track", async () => {
    const { computeDisclosure } = await load();
    const music = asset({ id: "m", path: "assets/music/x.mp3", kind: "audio", aiGenerated: true });
    expect(
      computeDisclosure(project({ music: { asset: "assets/music/x.mp3" }, assets: [music] }))
        .aiMusic,
    ).toBe(true);
    const sfx = asset({ id: "f", path: "assets/sfx/pop.wav", kind: "audio", aiGenerated: true });
    expect(
      computeDisclosure(project({ music: { asset: "assets/music/x.mp3" }, assets: [sfx] })).aiMusic,
    ).toBe(false);
  });

  it("takes the strongest voice-clone level across assets", async () => {
    const { computeDisclosure } = await load();
    const a = [
      asset({ id: "v1", kind: "audio", voiceClone: "self" }),
      asset({ id: "v2", kind: "audio", voiceClone: "consented" }),
    ];
    expect(computeDisclosure(project({ assets: a })).voiceClone).toBe("consented");
  });

  it("fails on a missing licence and on declaring less than the assets imply", async () => {
    const { buildCredits } = await load();
    const noLicence = buildCredits(project({ assets: [asset({ licence: "  " })] }));
    expect(noLicence.problems).toEqual(['asset "a" has no licence']);
    const under = buildCredits(
      project({
        assets: [asset({ kind: "image", aiGenerated: true, realistic: true, voiceClone: "self" })],
        disclosure: { realisticSynthetic: false, voiceClone: "none" },
      }),
    );
    expect(under.problems.join("\n")).toMatch(
      /realisticSynthetic is false but the assets say true/,
    );
    expect(under.problems.join("\n")).toMatch(/voiceClone is "none" but the assets say "self"/);
    // declaring more than needed is fine
    expect(buildCredits(project({ disclosure: { realisticSynthetic: true } })).ok).toBe(true);
  });

  it("adds the kids reminder and renders readable text", async () => {
    const { buildCredits, creditsText } = await load();
    const v = project({ assets: [asset({ attribution: "Photo by Sam" })] });
    v.meta.audience = "kids-3-5";
    const { credits } = buildCredits(v);
    expect(credits.guidance.join(" ")).toMatch(/made for kids/);
    const txt = creditsText(credits);
    expect(txt).toMatch(
      /assets\/a\.png\n {2}source: user\n {2}licence: own\n {2}attribution: Photo by Sam/,
    );
  });

  it("writes the same files every run and nothing when it fails", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-credits-"));
    const script = skillFile("video-core", "scripts/credits.mjs");
    writeFileSync(path.join(dir, "video.json"), JSON.stringify(project({ assets: [asset({})] })));
    expect(spawnSync("node", [script, dir]).status).toBe(0);
    const first = readFileSync(path.join(dir, "credits.json"), "utf8");
    spawnSync("node", [script, dir]);
    expect(readFileSync(path.join(dir, "credits.json"), "utf8")).toBe(first);
    expect(existsSync(path.join(dir, "CREDITS.txt"))).toBe(true);

    const bad = mkdtempSync(path.join(os.tmpdir(), "video-credits-"));
    writeFileSync(
      path.join(bad, "video.json"),
      JSON.stringify(project({ assets: [asset({ licence: "" })] })),
    );
    expect(spawnSync("node", [script, bad]).status).toBe(1);
    expect(existsSync(path.join(bad, "credits.json"))).toBe(false);
  });
});
