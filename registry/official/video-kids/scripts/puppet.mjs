#!/usr/bin/env node
// Makes and checks puppet rigs. `scaffold` draws a plain, original starter character from a bible (shape
// language, palette, species) as characters/<name>/puppet.json; edit it or replace it with your own SVG parts.
// `check` validates any rig, including one a user supplied (shapes only: no scripts, links, images or styles).
// `sheet` writes characters/<name>/sheet.svg: the character with every mouth shape and the blink, to look at.
// Text in, text out: nothing is run, fetched or installed.
// Usage: node puppet.mjs scaffold|check|sheet <project-dir> --character <name> [--force] [--flat]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bibleProblems, contrast, loadBible } from "./bible-check.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";
import { VISEMES, bindGradients, gradientDefs, partTree, rigProblems } from "./_rig.mjs";

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
      `<ellipse cx="116" cy="52" rx="17" ry="42" fill="${body}"/><ellipse cx="184" cy="52" rx="17" ry="42" fill="${body}"/><ellipse cx="116" cy="56" rx="8" ry="27" fill="${accent}"/><ellipse cx="184" cy="56" rx="8" ry="27" fill="${accent}"/>`,
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
    `<path d="M110 100 Q124 93 138 97" ${stroke(line, 5)}/><path d="M162 97 Q176 93 190 100" ${stroke(line, 5)}/>`,
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

const hex = (h) =>
  h.length === 4
    ? [...h.slice(1)].map((c) => parseInt(c + c, 16))
    : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** Mix two colours: t = 0 gives `a`, 1 gives `b`. */
const mix = (a, b, t) =>
  `#${hex(a)
    .map((v, i) =>
      Math.round(v + (hex(b)[i] - v) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/** A limb as a closed capsule path (a stroked line has no width to paint a gradient across). */
function capsule(x1, y1, x2, y2, w) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const r = w / 2;
  const nx = (-dy / len) * r;
  const ny = (dx / len) * r;
  const f = (n) => Math.round(n * 10) / 10;
  return `M${f(x1 + nx)} ${f(y1 + ny)} A${r} ${r} 0 0 1 ${f(x1 - nx)} ${f(y1 - ny)} L${f(x2 - nx)} ${f(y2 - ny)} A${r} ${r} 0 0 1 ${f(x2 + nx)} ${f(y2 + ny)} Z`;
}

/** The starter rig with a shaded, rounded look: gradients for volume, a gloss, glossy eyes, a soft floor shadow. */
export function scaffoldShaded(bible, name) {
  const colours = bible.colours;
  const [body, accent, bellyColour] = colours;
  const shape = bible["shape-language"].toLowerCase();
  const line = ink(colours, body);
  const mouthFill = contrast(line, "#ffffff") > 4.5 ? line : "#3b1d1d";
  const species = (bible.species ?? "").toLowerCase().split(/\s+/).pop();
  const radial = (c, fx = 0.35, fy = 0.3) => ({
    type: "radial",
    cx: 0.45,
    cy: 0.5,
    r: 0.75,
    fx,
    fy,
    stops: [
      { o: 0, c: mix(c, "#ffffff", 0.45) },
      { o: 0.55, c },
      { o: 1, c: mix(c, "#000000", 0.38) },
    ],
  });
  const gradients = {
    skin: radial(body),
    limb: {
      type: "linear",
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      stops: [
        { o: 0, c: mix(body, "#ffffff", 0.25) },
        { o: 0.5, c: body },
        { o: 1, c: mix(body, "#000000", 0.4) },
      ],
    },
    belly: radial(bellyColour, 0.4, 0.3),
    accent: radial(accent),
    shadow: {
      type: "radial",
      cx: 0.5,
      cy: 0.5,
      r: 0.5,
      stops: [
        { o: 0, c: "#000000", a: 0.42 },
        { o: 1, c: "#000000", a: 0 },
      ],
    },
    gloss: {
      type: "radial",
      cx: 0.5,
      cy: 0.5,
      r: 0.5,
      stops: [
        { o: 0, c: "#ffffff", a: 0.7 },
        { o: 1, c: "#ffffff", a: 0 },
      ],
    },
    eye: radial("#ffffff", 0.4, 0.35),
    iris: radial(mix(line, "#ffffff", 0.2), 0.35, 0.3),
    mouth: {
      type: "radial",
      cx: 0.5,
      cy: 0.4,
      r: 0.6,
      stops: [
        { o: 0, c: mix(mouthFill, "#ffffff", 0.12) },
        { o: 1, c: mix(mouthFill, "#000000", 0.5) },
      ],
    },
    blush: {
      type: "radial",
      cx: 0.5,
      cy: 0.5,
      r: 0.5,
      stops: [
        { o: 0, c: mix(accent, "#e8545a", 0.6), a: 0.7 },
        { o: 1, c: mix(accent, "#e8545a", 0.6), a: 0 },
      ],
    },
  };
  const rim = (c, w = 2.5) =>
    `stroke="${mix(c, "#000000", 0.45)}" stroke-width="${w}" stroke-opacity="0.55"`;
  const stroke = (c, w) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"`;
  const body3d = {
    round: `<ellipse cx="150" cy="270" rx="72" ry="82" fill="url(#g:skin)" ${rim(body)}/><ellipse cx="150" cy="288" rx="44" ry="54" fill="url(#g:belly)"/><ellipse cx="124" cy="226" rx="26" ry="16" fill="url(#g:gloss)"/>`,
    square: `<rect x="80" y="190" width="140" height="150" rx="22" fill="url(#g:skin)" ${rim(body)}/><rect x="108" y="224" width="84" height="94" rx="14" fill="url(#g:belly)"/><ellipse cx="116" cy="214" rx="26" ry="14" fill="url(#g:gloss)"/>`,
    triangle: `<path d="M150 184 L78 336 L222 336 Z" fill="url(#g:skin)" stroke-linejoin="round" ${rim(body, 16)}/><path d="M150 236 L116 316 L184 316 Z" fill="url(#g:belly)" stroke="${bellyColour}" stroke-width="8" stroke-linejoin="round"/><ellipse cx="128" cy="262" rx="7" ry="38" fill="url(#g:gloss)" transform="rotate(25,128,262)"/>`,
  }[shape];
  const head3d = {
    round: `<circle cx="150" cy="128" r="66" fill="url(#g:skin)" ${rim(body)}/><ellipse cx="124" cy="92" rx="28" ry="16" fill="url(#g:gloss)"/>`,
    square: `<rect x="86" y="64" width="128" height="124" rx="30" fill="url(#g:skin)" ${rim(body)}/><ellipse cx="120" cy="86" rx="30" ry="14" fill="url(#g:gloss)"/>`,
    triangle: `<path d="M150 62 L90 186 L210 186 Z" fill="url(#g:skin)" stroke-linejoin="round" ${rim(body, 18)}/><ellipse cx="133" cy="126" rx="6" ry="30" fill="url(#g:gloss)" transform="rotate(26,133,126)"/>`,
  }[shape];
  const parts = [];
  const add = (id, parent, pivot, svg) => parts.push({ id, parent, pivot, svg });
  add(
    "shadow",
    null,
    [150, 392],
    `<ellipse cx="150" cy="390" rx="104" ry="14" fill="url(#g:shadow)"/>`,
  );
  if (SHELLED.has(species))
    add(
      "shell",
      null,
      [150, 270],
      `<ellipse cx="150" cy="262" rx="104" ry="96" fill="url(#g:accent)" ${rim(accent)}/><path d="M96 262 L204 262 M150 170 L150 262" ${stroke(mix(accent, "#000000", 0.45), 5)} opacity="0.5"/><ellipse cx="116" cy="204" rx="30" ry="16" fill="url(#g:gloss)"/>`,
    );
  add("body", null, [150, 230], body3d);
  add(
    "leg-l",
    "body",
    [122, 330],
    `<path d="${capsule(122, 330, 118, 384, 28)}" fill="url(#g:limb)" ${rim(body)}/>`,
  );
  add(
    "leg-r",
    "body",
    [178, 330],
    `<path d="${capsule(178, 330, 182, 384, 28)}" fill="url(#g:limb)" ${rim(body)}/>`,
  );
  add(
    "arm-l",
    "body",
    [90, 218],
    `<path d="${capsule(90, 218, 56, 292, 24)}" fill="url(#g:limb)" ${rim(body)}/>`,
  );
  add(
    "arm-r",
    "body",
    [210, 218],
    `<path d="${capsule(210, 218, 244, 292, 24)}" fill="url(#g:limb)" ${rim(body)}/>`,
  );
  add("head", "body", [150, 190], head3d);
  const ears = EARS[species];
  if (ears === "long")
    add(
      "ears",
      "head",
      [150, 80],
      `<ellipse cx="116" cy="52" rx="17" ry="42" fill="url(#g:skin)" ${rim(body)}/><ellipse cx="184" cy="52" rx="17" ry="42" fill="url(#g:skin)" ${rim(body)}/><ellipse cx="116" cy="58" rx="8" ry="27" fill="url(#g:accent)"/><ellipse cx="184" cy="58" rx="8" ry="27" fill="url(#g:accent)"/>`,
    );
  else if (ears === "round")
    add(
      "ears",
      "head",
      [150, 80],
      `<circle cx="100" cy="72" r="24" fill="url(#g:skin)" ${rim(body)}/><circle cx="200" cy="72" r="24" fill="url(#g:skin)" ${rim(body)}/><circle cx="100" cy="76" r="12" fill="url(#g:accent)"/><circle cx="200" cy="76" r="12" fill="url(#g:accent)"/>`,
    );
  add(
    "cheeks",
    "head",
    [150, 150],
    `<circle cx="104" cy="150" r="17" fill="url(#g:blush)"/><circle cx="196" cy="150" r="17" fill="url(#g:blush)"/>`,
  );
  add(
    "brows",
    "head",
    [150, 100],
    `<path d="M110 100 Q124 93 138 97" ${stroke(line, 5)}/><path d="M162 97 Q176 93 190 100" ${stroke(line, 5)}/>`,
  );
  const eyes = (cx) =>
    `<ellipse cx="${cx}" cy="120" rx="15" ry="17" fill="url(#g:eye)" stroke="${mix(line, "#ffffff", 0.5)}" stroke-width="1.5" stroke-opacity="0.5"/><circle cx="${cx + 2}" cy="123" r="9" fill="url(#g:iris)"/><circle cx="${cx + 2}" cy="123" r="4.5" fill="${line}"/><circle cx="${cx - 2}" cy="117" r="4" fill="#ffffff" opacity="0.95"/><circle cx="${cx + 6}" cy="127" r="1.8" fill="#ffffff" opacity="0.8"/>`;
  add("eyes-open", "head", [150, 120], eyes(126) + eyes(174));
  add(
    "eyes-closed",
    "head",
    [150, 120],
    `<path d="M111 124 Q126 112 141 124" ${stroke(line, 5)}/><path d="M159 124 Q174 112 189 124" ${stroke(line, 5)}/>`,
  );
  const m = (inner) => inner.replaceAll("MOUTH", "url(#g:mouth)");
  const mouth = {
    rest: `<path d="M134 160 Q150 171 166 160" ${stroke(line, 5)}/>`,
    a: m(
      `<ellipse cx="150" cy="165" rx="16" ry="17" fill="MOUTH"/><ellipse cx="150" cy="173" rx="9" ry="5" fill="${mix(accent, "#c0392b", 0.5)}"/>`,
    ),
    e: m(
      `<ellipse cx="150" cy="162" rx="19" ry="8" fill="MOUTH"/><rect x="138" y="157" width="24" height="4" rx="2" fill="#ffffff"/>`,
    ),
    o: m(`<ellipse cx="150" cy="165" rx="9" ry="12" fill="MOUTH"/>`),
    u: m(`<ellipse cx="150" cy="163" rx="6" ry="7" fill="MOUTH"/>`),
    mbp: `<path d="M136 161 Q150 166 164 161" ${stroke(line, 6)}/>`,
    fv: m(
      `<path d="M136 156 L164 156 L160 167 Q150 172 140 167 Z" fill="MOUTH"/><rect x="141" y="156" width="18" height="6" rx="2" fill="#ffffff"/>`,
    ),
    l: m(
      `<ellipse cx="150" cy="164" rx="13" ry="10" fill="MOUTH"/><ellipse cx="150" cy="169" rx="7" ry="4.5" fill="${mix(accent, "#c0392b", 0.5)}"/>`,
    ),
  };
  for (const v of VISEMES) add(`mouth-${v}`, "head", [150, 160], mouth[v]);
  return { name, box: { ...BOX }, palette: colours, gradients, parts };
}

const hiddenUnless = (id, shown) => (shown.has(id) ? "" : ' style="display:none"');
function partSvg(node, shown, prefix) {
  return `<g${hiddenUnless(node.id, shown)}>${bindGradients(node.svg, prefix)}${node.children.map((c) => partSvg(c, shown, prefix)).join("")}</g>`;
}

/** The character as one SVG picture showing the parts in `shown` (everything else hidden). `prefix` keeps gradient ids apart. */
export function posePicture(rig, shown, prefix = "p") {
  return (
    gradientDefs(rig.gradients, prefix) +
    partTree(rig)
      .map((n) => partSvg(n, shown, prefix))
      .join("")
  );
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
    return `<g transform="translate(${x} ${y})"><rect width="${rig.box.w}" height="${rig.box.h}" fill="#f3f1ec"/>${posePicture(rig, new Set(shown), `c${i}`)}<text x="${rig.box.w / 2}" y="${rig.box.h + 28}" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#333">${label}</text></g>`;
  });
  const W = 5 * (rig.box.w + pad) + 10;
  const H = Math.ceil(cells.length / 5) * (rig.box.h + 50) + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${cells.join("")}</svg>\n`;
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2), {
    strings: ["character"],
    booleans: ["force", "flat"],
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
      "Usage: node puppet.mjs scaffold|check|sheet <project-dir> --character <name> [--force] [--flat]",
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
    const rig = flags.flat ? scaffold(found.bible, name) : scaffoldShaded(found.bible, name);
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
