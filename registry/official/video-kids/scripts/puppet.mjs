#!/usr/bin/env node
// Makes and checks puppet rigs. `scaffold` draws a plain, original starter character from a bible (shape
// language, palette, species) as characters/<name>/puppet.json; edit it or replace it with your own SVG parts.
// `check` validates any rig, including one a user supplied (shapes only: no scripts, links, images or styles).
// `sheet` writes characters/<name>/sheet.svg: the character with every mouth shape and the blink, to look at.
// Text in, text out: nothing is run, fetched or installed.
// Usage: node puppet.mjs scaffold|check|sheet <project-dir> --character <name> [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bibleProblems, contrast, loadBible } from "./bible-check.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";
import { VISEMES, partTree, rigProblems } from "./_rig.mjs";

const BOX = { w: 300, h: 400 };
const EARS = {
  rabbit: "long",
  bunny: "long",
  hare: "long",
  cat: "round",
  kitten: "round",
  fox: "round",
  bear: "round",
  mouse: "round",
  dog: "round",
  puppy: "round",
  lion: "round",
  panda: "round",
};
const SHELLED = new Set(["turtle", "tortoise", "snail"]);

const darkest = (colours) =>
  [...colours].sort((a, b) => contrast(b, "#ffffff") - contrast(a, "#ffffff"))[0];
const ink = (colours, body) => {
  const d = darkest(colours);
  return contrast(d, body) >= 4.5 ? d : "#2b2230";
};

const shapeBody = (shape, fill, accent) =>
  ({
    round: `<ellipse cx="150" cy="270" rx="72" ry="82" fill="${fill}"/><ellipse cx="150" cy="285" rx="44" ry="54" fill="${accent}"/>`,
    square: `<rect x="80" y="190" width="140" height="150" rx="16" fill="${fill}"/><rect x="108" y="224" width="84" height="94" rx="10" fill="${accent}"/>`,
    triangle: `<path d="M150 184 L78 336 L222 336 Z" fill="${fill}" stroke="${fill}" stroke-width="16" stroke-linejoin="round"/><path d="M150 236 L116 316 L184 316 Z" fill="${accent}" stroke="${accent}" stroke-width="8" stroke-linejoin="round"/>`,
  })[shape];
const shapeHead = (shape, fill) =>
  ({
    round: `<circle cx="150" cy="128" r="66" fill="${fill}"/>`,
    square: `<rect x="86" y="64" width="128" height="124" rx="22" fill="${fill}"/>`,
    triangle: `<path d="M150 62 L90 186 L210 186 Z" fill="${fill}" stroke="${fill}" stroke-width="18" stroke-linejoin="round"/>`,
  })[shape];

/** A starter rig from a parsed bible. */
export function scaffold(bible, name) {
  const colours = bible.colours;
  const [body, accent, belly] = colours;
  const shape = bible["shape-language"].toLowerCase();
  const line = ink(colours, body);
  const mouthFill = contrast(line, "#ffffff") > 4.5 ? line : "#3b1d1d";
  const species = (bible.species ?? "").toLowerCase().split(/\s+/).pop();
  const stroke = (c, w) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"`;
  const limb = (x1, y1, x2, y2, w, c) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${stroke(c, w)}/>`;
  const parts = [];
  const add = (id, parent, pivot, svg) => parts.push({ id, parent, pivot, svg });
  if (SHELLED.has(species))
    add(
      "shell",
      null,
      [150, 270],
      `<ellipse cx="150" cy="262" rx="104" ry="96" fill="${accent}"/><path d="M96 262 L204 262 M150 170 L150 262" ${stroke(line, 5)} opacity="0.5"/>`,
    );
  add("body", null, [150, 230], shapeBody(shape, body, belly));
  add("leg-l", "body", [122, 330], limb(122, 330, 118, 384, 26, body));
  add("leg-r", "body", [178, 330], limb(178, 330, 182, 384, 26, body));
  add("arm-l", "body", [90, 218], limb(90, 218, 56, 292, 22, body));
  add("arm-r", "body", [210, 218], limb(210, 218, 244, 292, 22, body));
  add("head", "body", [150, 190], shapeHead(shape, body));
  const ears = EARS[species];
  if (ears === "long")
    add(
      "ears",
      "head",
      [150, 80],
      `<ellipse cx="118" cy="40" rx="17" ry="46" fill="${body}"/><ellipse cx="182" cy="40" rx="17" ry="46" fill="${body}"/><ellipse cx="118" cy="44" rx="8" ry="30" fill="${accent}"/><ellipse cx="182" cy="44" rx="8" ry="30" fill="${accent}"/>`,
    );
  else if (ears === "round")
    add(
      "ears",
      "head",
      [150, 80],
      `<circle cx="100" cy="72" r="24" fill="${body}"/><circle cx="200" cy="72" r="24" fill="${body}"/><circle cx="100" cy="74" r="11" fill="${accent}"/><circle cx="200" cy="74" r="11" fill="${accent}"/>`,
    );
  add(
    "cheeks",
    "head",
    [150, 150],
    `<circle cx="104" cy="148" r="13" fill="${accent}" opacity="0.7"/><circle cx="196" cy="148" r="13" fill="${accent}" opacity="0.7"/>`,
  );
  add(
    "brows",
    "head",
    [150, 100],
    `<line x1="110" y1="98" x2="138" y2="96" ${stroke(line, 5)}/><line x1="162" y1="96" x2="190" y2="98" ${stroke(line, 5)}/>`,
  );
  add(
    "eyes-open",
    "head",
    [150, 120],
    `<circle cx="126" cy="120" r="13" fill="#ffffff"/><circle cx="174" cy="120" r="13" fill="#ffffff"/><circle cx="128" cy="122" r="7" fill="${line}"/><circle cx="172" cy="122" r="7" fill="${line}"/>`,
  );
  add(
    "eyes-closed",
    "head",
    [150, 120],
    `<path d="M113 124 Q126 114 139 124" ${stroke(line, 5)}/><path d="M161 124 Q174 114 187 124" ${stroke(line, 5)}/>`,
  );
  const mouth = {
    rest: `<path d="M134 160 Q150 170 166 160" ${stroke(line, 5)}/>`,
    a: `<ellipse cx="150" cy="164" rx="15" ry="16" fill="${mouthFill}"/>`,
    e: `<ellipse cx="150" cy="162" rx="18" ry="7" fill="${mouthFill}"/>`,
    o: `<ellipse cx="150" cy="164" rx="9" ry="12" fill="${mouthFill}"/>`,
    u: `<ellipse cx="150" cy="163" rx="6" ry="7" fill="${mouthFill}"/>`,
    mbp: `<line x1="136" y1="161" x2="164" y2="161" ${stroke(line, 6)}/>`,
    fv: `<path d="M136 156 L164 156 L160 166 Q150 171 140 166 Z" fill="${mouthFill}"/><rect x="141" y="156" width="18" height="6" fill="#ffffff"/>`,
    l: `<ellipse cx="150" cy="163" rx="13" ry="9" fill="${mouthFill}"/><circle cx="150" cy="167" r="5" fill="${accent}"/>`,
  };
  for (const v of VISEMES) add(`mouth-${v}`, "head", [150, 160], mouth[v]);
  return { name, box: { ...BOX }, palette: colours, parts };
}

const hiddenUnless = (id, shown) => (shown.has(id) ? "" : ' style="display:none"');
function partSvg(node, shown) {
  return `<g${hiddenUnless(node.id, shown)}>${node.svg}${node.children.map((c) => partSvg(c, shown)).join("")}</g>`;
}

/** The character as one SVG picture showing the parts in `shown` (everything else hidden). */
export function posePicture(rig, shown) {
  return partTree(rig)
    .map((n) => partSvg(n, shown))
    .join("");
}

/** A contact sheet: the character with each mouth shape, then with eyes closed. */
export function sheet(rig) {
  const ids = rig.parts.map((p) => p.id);
  const still = ids.filter((id) => !id.startsWith("mouth-") && !id.startsWith("eyes-"));
  const looks = [
    ...VISEMES.map((v) => [v, [...still, "eyes-open", `mouth-${v}`]]),
    ["blink", [...still, "eyes-closed", "mouth-rest"]],
  ];
  const pad = 20;
  const cells = looks.map(([label, shown], i) => {
    const x = (i % 5) * (rig.box.w + pad) + 10;
    const y = Math.floor(i / 5) * (rig.box.h + 50) + 10;
    return `<g transform="translate(${x} ${y})"><rect width="${rig.box.w}" height="${rig.box.h}" fill="#f3f1ec"/>${posePicture(rig, new Set(shown))}<text x="${rig.box.w / 2}" y="${rig.box.h + 28}" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#333">${label}</text></g>`;
  });
  const W = 5 * (rig.box.w + pad) + 10;
  const H = Math.ceil(cells.length / 5) * (rig.box.h + 50) + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${cells.join("")}</svg>\n`;
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
  if (!["scaffold", "check", "sheet"].includes(cmd) || !name)
    fail(
      "Usage: node puppet.mjs scaffold|check|sheet <project-dir> --character <name> [--force]",
      2,
    );
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(name))
    fail("--character: lower-case letters, digits and hyphens", 2);
  const folder = path.join(dir, "characters", name);
  const rigFile = path.join(folder, "puppet.json");
  if (cmd === "scaffold") {
    const found = loadBible(dir, name);
    if (!found)
      fail(
        `characters/${name}/bible.md is missing: write the bible first (references/character-bible.md).`,
      );
    const bad = bibleProblems(found.bible, name, found.text);
    if (bad.length) fail(`The bible is not ready: ${bad[0]} (run bible-check.mjs).`);
    if (existsSync(rigFile) && !flags.force)
      fail(
        `characters/${name}/puppet.json already exists; it is never overwritten without --force.`,
      );
    mkdirSync(folder, { recursive: true });
    const rig = scaffold(found.bible, name);
    const problems = rigProblems(rig);
    if (problems.length) fail(`The starter rig failed its own check: ${problems[0]}`);
    writeFileSync(rigFile, JSON.stringify(rig, null, 2) + "\n");
    console.log(
      `Wrote characters/${name}/puppet.json (${rig.parts.length} parts). Next: node puppet.mjs sheet ${projectArg ?? "."} --character ${name}`,
    );
    return;
  }
  if (!existsSync(rigFile)) fail(`characters/${name}/puppet.json is missing: run scaffold first.`);
  let rig;
  try {
    rig = JSON.parse(readFileSync(rigFile, "utf8"));
  } catch {
    fail(`characters/${name}/puppet.json is not valid JSON.`);
  }
  const problems = rigProblems(rig);
  if (cmd === "check") {
    console.log(
      capLines(
        problems.map((p) => `ERROR ${p}`),
        problems.length
          ? `${problems.length} problem(s).`
          : `ok ${name}: ${rig.parts.length} parts, all mouth shapes present.`,
      ),
    );
    process.exit(problems.length ? 1 : 0);
  }
  if (problems.length) fail(`The rig has problems (${problems[0]}); run check.`);
  writeFileSync(path.join(folder, "sheet.svg"), sheet(rig));
  console.log(
    `Wrote characters/${name}/sheet.svg: open it in a browser to see every mouth shape and the blink.`,
  );
}

if (isEntry(import.meta.url)) main();
