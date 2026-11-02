import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const PY = path.join(os.homedir(), ".aisle-video", "venv", "bin", "python");
const haveCv = existsSync(PY) && spawnSync(PY, ["-c", "import cv2,numpy"]).status === 0;
const CANARY = "sk-canary-0000000000000000000000";
const script = (name: string, args: string[]) =>
  spawnSync(process.execPath, [skillFile("video-drawing", `scripts/${name}`), ...args], {
    encoding: "utf8",
    env: { ...process.env, ANTHROPIC_API_KEY: CANARY },
  });
const drawing = (...args: string[]) => script("drawing.mjs", args);
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "video-drawing-"));
const fixture = (dir: string, kind: "drawing" | "photo") => {
  const out = path.join(dir, `${kind}.png`);
  const r = spawnSync(PY, [path.join(__dirname, "fixtures", "make-drawing.py"), kind, out], {
    encoding: "utf8",
  });
  expect(r.status).toBe(0);
  return out;
};
const same = (a: [string, string], b: [string, string]) =>
  expect(readFileSync(skillFile(...a), "utf8")).toBe(readFileSync(skillFile(...b), "utf8"));

describe("video-drawing copies", () => {
  it("keeps byte-identical copies", () => {
    same(["video-drawing", "scripts/_lib.mjs"], ["video-core", "scripts/_lib.mjs"]);
    same(["video-drawing", "scripts/_rig.mjs"], ["video-core", "assets/puppet/rig.mjs"]);
    same(["video-drawing", "scripts/run.mjs"], ["video-kids", "scripts/run.mjs"]);
    same(["video-drawing", "scripts/bible-check.mjs"], ["video-kids", "scripts/bible-check.mjs"]);
  });
});

describe("pure functions", () => {
  const trace = {
    aspect: 0.75,
    paper: "#f5f0e1",
    palette: ["#f08c28", "#fad23c"],
    regions: [
      {
        id: "r1",
        color: "#f08c28",
        area: 0.2,
        bbox: [0.2, 0.4, 0.6, 0.4],
        polygon: [
          [0.2, 0.4],
          [0.8, 0.4],
          [0.5, 0.8],
        ],
      },
      {
        id: "r2",
        color: "#fad23c",
        area: 0.1,
        bbox: [0.35, 0.05, 0.3, 0.25],
        polygon: [
          [0.35, 0.05],
          [0.65, 0.05],
          [0.5, 0.3],
        ],
      },
    ],
  };
  it("checks traces and marks and pads the bible palette to 3 colours", async () => {
    const m = await loadScript<Loose>("video-drawing", "scripts/drawing.mjs");
    expect(m.traceProblems(trace)).toEqual([]);
    expect(
      m.traceProblems({ ...trace, regions: [{ ...trace.regions[0], color: "red" }] })[0],
    ).toContain("#hex");
    expect(m.bibleColours(trace).length).toBeGreaterThanOrEqual(3);
    const good = { parts: { body: ["r1"], head: ["r2"] }, face: { x: 0.5, y: 0.15, size: 0.3 } };
    expect(m.marksProblems(good, trace)).toEqual([]);
    expect(m.marksProblems({ ...good, parts: { body: ["r1"], head: ["r9"] } }, trace)[0]).toContain(
      "not a traced region",
    );
    expect(m.marksProblems({ ...good, parts: { body: ["r1"], head: ["r1"] } }, trace)[0]).toContain(
      "twice",
    );
    expect(m.marksProblems({ parts: { body: ["r1"] }, face: good.face }, trace)[0]).toContain(
      "head",
    );
  });
  it("builds a valid rig and reports a missing limb instead of inventing it", async () => {
    const m = await loadScript<Loose>("video-drawing", "scripts/drawing.mjs");
    const rigMod = await loadScript<Loose>("video-drawing", "scripts/_rig.mjs");
    const marks = { parts: { body: ["r1"], head: ["r2"] }, face: { x: 0.5, y: 0.15, size: 0.3 } };
    const { rig, notes } = m.buildRig(trace, marks, "pip", ["#f08c28", "#fad23c", "#2b2230"]);
    expect(rigMod.rigProblems(rig)).toEqual([]);
    expect(notes.join(" ")).toContain("arm-l: not marked");
    expect(JSON.stringify(rig)).not.toContain("image");
  });
});

describe.skipIf(!haveCv)("import, rig and forget (needs OpenCV in the video venv)", () => {
  const setup = () => {
    const dir = tmp();
    const img = fixture(dir, "drawing");
    const proj = path.join(dir, "proj");
    return { dir, img, proj, priv: path.join(proj, "characters", "pip", "private") };
  };
  const fillBible = (proj: string) => {
    const f = path.join(proj, "characters", "pip", "bible.md");
    writeFileSync(
      f,
      readFileSync(f, "utf8")
        .replace("Species: TODO", "Species: fox")
        .replace("Shape language: TODO", "Shape language: round")
        .replace("Outfits: TODO", "Outfits: a blue scarf")
        .replace("Catchphrase: TODO", 'Catchphrase: "Let us try together!"')
        .replace("Personality: TODO", "Personality: Cheerful and curious.")
        .replace("Learning goal: TODO", "Learning goal: sharing"),
    );
  };

  it("needs the parent's yes and refuses links, URLs and other file types", () => {
    const { dir, img, proj } = setup();
    expect(drawing("import", proj, "--character", "pip", "--image", img).stderr).toContain(
      "--parent-ok",
    );
    expect(
      drawing(
        "import",
        proj,
        "--character",
        "pip",
        "--image",
        "https://example.com/a.png",
        "--parent-ok",
      ).status,
    ).toBe(2);
    writeFileSync(path.join(dir, "a.gif"), "GIF89a");
    expect(
      drawing(
        "import",
        proj,
        "--character",
        "pip",
        "--image",
        path.join(dir, "a.gif"),
        "--parent-ok",
      ).stderr,
    ).toContain("png");
    const link = path.join(dir, "link.png");
    symlinkSync(img, link);
    expect(
      drawing("import", proj, "--character", "pip", "--image", link, "--parent-ok").stderr,
    ).toContain("not a link");
    writeFileSync(path.join(dir, "fake.png"), "not an image");
    expect(
      drawing(
        "import",
        proj,
        "--character",
        "pip",
        "--image",
        path.join(dir, "fake.png"),
        "--parent-ok",
      ).stderr,
    ).toContain("not really");
  });

  it("refuses a photo-like picture and keeps nothing", () => {
    const dir = tmp();
    const photo = fixture(dir, "photo");
    const proj = path.join(dir, "proj");
    const r = drawing("import", proj, "--character", "pip", "--image", photo, "--parent-ok");
    expect(r.status).toBe(4);
    expect(existsSync(path.join(proj, "characters", "pip", "private"))).toBe(false);
  });

  it("traces, rigs, passes the rig check and forgets", () => {
    const { img, proj, priv } = setup();
    const r = drawing("import", proj, "--character", "pip", "--image", img, "--parent-ok");
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).not.toContain(CANARY);
    expect(readFileSync(path.join(priv, ".gitignore"), "utf8")).toBe("*\n");
    for (const f of ["original.png", "trace.json", "marks.json", "trace-sheet.svg"])
      expect(existsSync(path.join(priv, f))).toBe(true);
    // The bible still has TODO lines.
    expect(drawing("rig", proj, "--character", "pip").stderr).toContain("TODO");
    fillBible(proj);
    const rig = drawing("rig", proj, "--character", "pip");
    expect(rig.status).toBe(0);
    const puppet = JSON.parse(
      readFileSync(path.join(proj, "characters", "pip", "puppet.json"), "utf8"),
    ) as Loose;
    expect(puppet.parts.map((p: Loose) => p.id)).toEqual(
      expect.arrayContaining(["body", "head", "mouth-a", "eyes-closed"]),
    );
    const kids = spawnSync(
      process.execPath,
      [skillFile("video-kids", "scripts/puppet.mjs"), "check", proj, "--character", "pip"],
      { encoding: "utf8" },
    );
    expect(kids.status).toBe(0);
    expect(drawing("rig", proj, "--character", "pip").stderr).toContain("never overwritten");
    expect(drawing("status", proj, "--character", "pip").stdout).toContain("exists");
    expect(drawing("forget", proj, "--character", "pip").status).toBe(2); // needs --yes
    expect(existsSync(priv)).toBe(true);
    expect(drawing("forget", proj, "--character", "pip", "--yes").status).toBe(0);
    expect(existsSync(priv)).toBe(false);
    expect(existsSync(path.join(proj, "characters", "pip", "puppet.json"))).toBe(true);
    // The drawing is nowhere in the rig.
    expect(JSON.stringify(puppet)).not.toMatch(/original|private/);
  });

  it("refuses marks that name a region that is not there", () => {
    const { img, proj, priv } = setup();
    drawing("import", proj, "--character", "pip", "--image", img, "--parent-ok");
    fillBible(proj);
    const marks = JSON.parse(readFileSync(path.join(priv, "marks.json"), "utf8")) as Loose;
    marks.parts.head = ["r99"];
    writeFileSync(path.join(priv, "marks.json"), JSON.stringify(marks));
    expect(drawing("rig", proj, "--character", "pip").stderr).toContain("not a traced region");
  });
});
