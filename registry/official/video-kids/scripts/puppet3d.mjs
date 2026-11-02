#!/usr/bin/env node
// Makes and checks 3D puppet rigs. `scaffold` builds a starter character from a bible out of plain primitives
// (spheres, capsules, rounded boxes, droplets) and materials, as characters/<name>/puppet3d.json. Edit it, or
// write your own; `check` validates any 3D rig (data only: no models, textures or scripts). To see it, set
// "look": "3d" in a puppet scene and render a draft. Text in, text out: nothing is run, fetched or installed.
// Usage: node puppet3d.mjs scaffold|check <project-dir> --character <name> [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bibleProblems, contrast, loadBible } from "./bible-check.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";
import { rig3dProblems } from "./_rig3d.mjs";

const SHELLED = new Set(["turtle", "tortoise", "snail"]);
const LONG_EARS = new Set(["rabbit", "bunny", "hare"]);
const ROUND_EARS = new Set([
  "cat",
  "kitten",
  "fox",
  "bear",
  "mouse",
  "dog",
  "puppy",
  "lion",
  "panda",
]);
const r3 = (n) => Math.round(n * 1000) / 1000;

/** The starter 3D rig from a parsed bible. World units; the character stands on y = 0 and faces +z. */
export function scaffold3d(bible, name) {
  const [body, accent, bellyColour] = bible.colours;
  const shape = bible["shape-language"].toLowerCase();
  const darkest = [...bible.colours].sort(
    (a, b) => contrast(b, "#ffffff") - contrast(a, "#ffffff"),
  )[0];
  const ink = contrast(darkest, body) >= 4.5 ? darkest : "#2b2230";
  const species = (bible.species ?? "").toLowerCase().split(/\s+/).pop();
  const materials = {
    skin: { color: body, roughness: 0.42, clearcoat: 0.35, sheen: 0.6 },
    belly: { color: bellyColour, roughness: 0.5, clearcoat: 0.2, sheen: 0.4 },
    accent: { color: accent, roughness: 0.45, clearcoat: 0.3, sheen: 0.5 },
    white: { color: "#ffffff", roughness: 0.25, clearcoat: 0.8 },
    ink: { color: ink, roughness: 0.2, clearcoat: 1 },
    mouth: { color: "#3b1d1d", roughness: 0.5 },
    tongue: { color: "#d9626b", roughness: 0.6 },
    pink: { color: "#ff8a7a", roughness: 0.8 },
    glint: { color: "#ffffff", emissive: "#ffffff", roughness: 0.2 },
  };
  const parts = [];
  const add = (id, parent, pivot, rest = {}) => parts.push({ id, parent, pivot, ...rest });

  // Body and head by shape language. `eye` is the head's centre height, `reach` how far the face stands out.
  const look = {
    round: {
      body: { shape: "sphere", size: [0.62, 0.72, 0.55] },
      head: { shape: "sphere", size: [0.6, 0.57, 0.55] },
      reach: 0.5,
      wide: 0.6,
    },
    square: {
      body: { shape: "box", size: [1.2, 1.3, 0.95], radius: 0.28 },
      head: { shape: "box", size: [1.15, 1.0, 0.95], radius: 0.3 },
      reach: 0.48,
      wide: 0.575,
    },
    triangle: {
      body: { shape: "droplet", size: [0.72, 1.5, 0.85] },
      head: { shape: "droplet", size: [0.62, 1.05, 0.9] },
      reach: 0.44,
      wide: 0.55,
    },
  }[shape];
  const hy = 0.3; // the head's centre above its pivot
  const front = (x, y) =>
    r3(look.reach * Math.sqrt(Math.max(0.2, 1 - (x / look.wide) ** 2 - (y / 0.57) ** 2)));

  if (SHELLED.has(species))
    add("shell", "body", [0, 0.05, -0.3], {
      shape: "sphere",
      size: [0.84, 0.72, 0.5],
      material: "accent",
    });
  add("body", null, [0, 0.95, 0], { ...look.body, material: "skin" });
  add("belly", "body", [0, -0.05, shape === "square" ? 0.46 : 0.3], {
    shape: shape === "square" ? "box" : "sphere",
    size: shape === "square" ? [0.7, 0.8, 0.1] : [0.4, 0.5, 0.3],
    radius: 0.08,
    material: "belly",
  });
  for (const [side, x] of [
    ["l", -0.28],
    ["r", 0.28],
  ])
    add(`leg-${side}`, "body", [x, -0.55, 0.04], {
      shape: "capsule",
      size: [0.15, 0.25, 1],
      position: [0, -0.125, 0],
      material: "skin",
    });
  for (const [side, x, k] of [
    ["l", -0.62, 1],
    ["r", 0.62, -1],
  ])
    add(
      `arm-${side}`,
      "body",
      [x * { round: 1, square: 1.05, triangle: 0.72 }[shape], shape === "triangle" ? 0.5 : 0.42, 0],
      {
        shape: "capsule",
        size: [0.12, 0.38, 1],
        position: [0.04 * k, -0.28, 0],
        rotation: [0, 0, 12 * k],
        material: "skin",
      },
    );
  add("head", "body", [0, 0.82, 0.05], { ...look.head, position: [0, hy, 0], material: "skin" });
  if (LONG_EARS.has(species))
    for (const [side, x, k] of [
      ["l", -0.25, 1],
      ["r", 0.25, -1],
    ])
      add(`ear-${side}`, "head", [x, hy + (shape === "triangle" ? 0.3 : 0.55), -0.05], {
        shape: "capsule",
        size: [0.1, 0.55, 0.6],
        position: [0, 0.25, 0],
        rotation: [0, 0, 8 * k],
        material: "skin",
      });
  else if (ROUND_EARS.has(species))
    for (const [side, x] of [
      ["l", -0.42],
      ["r", 0.42],
    ])
      add(`ear-${side}`, "head", [x, hy + (shape === "triangle" ? 0.3 : 0.42), -0.05], {
        shape: "sphere",
        size: [0.2, 0.2, 0.1],
        material: "skin",
      });
  for (const [side, x] of [
    ["l", -0.38],
    ["r", 0.38],
  ])
    add(`cheek-${side}`, "head", [x, hy - 0.1, front(x, -0.1)], {
      shape: "sphere",
      size: [0.09, 0.07, 0.03],
      material: "pink",
    });

  const eyeX = 0.22;
  const eyeY = hy + 0.08;
  add("brows", "head", [0, 0, 0]);
  for (const [side, x, k] of [
    ["l", -eyeX, 1],
    ["r", eyeX, -1],
  ])
    add(`brow-${side}`, "brows", [x, hy + 0.3, front(x, 0.3)], {
      shape: "capsule",
      size: [0.02, 0.15, 1],
      rotation: [0, 0, 90 - 8 * k],
      material: "ink",
    });
  add("eyes-open", "head", [0, 0, 0]);
  add("eyes-closed", "head", [0, 0, 0]);
  for (const [side, x] of [
    ["l", -eyeX],
    ["r", eyeX],
  ]) {
    const z = front(x, 0.08);
    add(`eye-${side}`, "eyes-open", [x, eyeY, z], {
      shape: "sphere",
      size: [0.13, 0.16, 0.07],
      material: "white",
    });
    add(`iris-${side}`, "eyes-open", [x + 0.015, eyeY - 0.01, z + 0.05], {
      shape: "sphere",
      size: [0.085, 0.105, 0.05],
      material: "ink",
    });
    add(`glint-${side}`, "eyes-open", [x - 0.015, eyeY + 0.045, z + 0.095], {
      shape: "sphere",
      size: [0.03, 0.03, 0.02],
      material: "glint",
    });
    add(`lid-${side}`, "eyes-closed", [x, eyeY - 0.02, z], {
      shape: "capsule",
      size: [0.02, 0.15, 1],
      rotation: [0, 0, 90],
      material: "ink",
    });
  }
  const mouthY = hy - 0.28;
  const mz = front(0, -0.28) - 0.02;
  const mouth = {
    rest: { shape: "capsule", size: [0.018, 0.15, 1], rotation: [0, 0, 90], material: "ink" },
    a: { shape: "sphere", size: [0.1, 0.115, 0.05], material: "mouth" },
    e: { shape: "sphere", size: [0.17, 0.055, 0.04], material: "mouth" },
    o: { shape: "sphere", size: [0.075, 0.095, 0.045], material: "mouth" },
    u: { shape: "sphere", size: [0.05, 0.058, 0.04], material: "mouth" },
    mbp: { shape: "capsule", size: [0.022, 0.13, 1], rotation: [0, 0, 90], material: "ink" },
    fv: { shape: "sphere", size: [0.13, 0.05, 0.04], material: "mouth" },
    l: { shape: "sphere", size: [0.105, 0.07, 0.045], material: "mouth" },
  };
  for (const [v, spec] of Object.entries(mouth)) add(`mouth-${v}`, "head", [0, mouthY, mz], spec);
  add("teeth-fv", "mouth-fv", [0, 0.035, 0.02], {
    shape: "box",
    size: [0.12, 0.025, 0.02],
    radius: 0.008,
    material: "white",
  });
  add("tongue-l", "mouth-l", [0, -0.02, 0.02], {
    shape: "sphere",
    size: [0.06, 0.035, 0.03],
    material: "tongue",
  });
  add("tongue-a", "mouth-a", [0, -0.05, 0.015], {
    shape: "sphere",
    size: [0.06, 0.035, 0.03],
    material: "tongue",
  });
  return { name, height: 2.7, palette: bible.colours, materials, parts };
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2), {
    strings: ["character"],
    booleans: ["force"],
  });
  const [cmd, projectArg] = positional;
  const dir = path.resolve(projectArg ?? ".");
  const name = flags.character;
  const fail = (m, code = 1) => {
    console.error(m);
    process.exit(code);
  };
  if (!["scaffold", "check"].includes(cmd) || !name)
    fail("Usage: node puppet3d.mjs scaffold|check <project-dir> --character <name> [--force]", 2);
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(name))
    fail("--character: lower-case letters, digits and hyphens", 2);
  const folder = path.join(dir, "characters", name);
  const file = path.join(folder, "puppet3d.json");
  if (cmd === "scaffold") {
    const found = loadBible(dir, name);
    if (!found)
      fail(
        `characters/${name}/bible.md is missing: write the bible first (references/character-bible.md).`,
      );
    const bad = bibleProblems(found.bible, name, found.text);
    if (bad.length) fail(`The bible is not ready: ${bad[0]} (run bible-check.mjs).`);
    if (existsSync(file) && !flags.force)
      fail(
        `characters/${name}/puppet3d.json already exists; it is never overwritten without --force.`,
      );
    mkdirSync(folder, { recursive: true });
    const rig = scaffold3d(found.bible, name);
    const problems = rig3dProblems(rig);
    if (problems.length) fail(`The starter rig failed its own check: ${problems[0]}`);
    writeFileSync(file, `${JSON.stringify(rig, null, 2)}\n`);
    console.log(
      `Wrote characters/${name}/puppet3d.json (${rig.parts.length} parts). Use "look": "3d" in a puppet scene, then render a draft.`,
    );
    return;
  }
  if (!existsSync(file)) fail(`characters/${name}/puppet3d.json is missing: run scaffold first.`);
  let rig;
  try {
    rig = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    fail(`characters/${name}/puppet3d.json is not valid JSON.`);
  }
  const problems = rig3dProblems(rig);
  console.log(
    capLines(
      problems.map((p) => `ERROR ${p}`),
      problems.length
        ? `${problems.length} problem(s).`
        : `ok ${name}: ${rig.parts.length} parts, ${Object.keys(rig.materials).length} materials.`,
    ),
  );
  process.exit(problems.length ? 1 : 0);
}

if (isEntry(import.meta.url)) main();
