// Builds a Remotion project (as a map of files) from the same parts the HyperFrames engine uses. Pure: it reads
// this folder's templates and the tween helper, and returns what to write; render-remotion.mjs writes it.
// The scene markup, stylesheet and animation plan are shared, so every scene kind works in both engines.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildParts } from "../../../scripts/project.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(path.join(here, ...p), "utf8");

/**
 * Same arguments as buildProject. Returns { files, media, fonts, notes, size, frames }. Media and fonts
 * are placed under public/ (their `to` paths already say so); film.json holds the film data.
 */
export function buildRemotionProject(args) {
  const p = buildParts(args);
  const [width, height] = p.size;
  const frames = Math.max(1, Math.round(p.seconds * p.fps));
  const film = {
    width,
    height,
    fps: p.fps,
    frames,
    seconds: p.seconds,
    lang: p.lang,
    dir: p.dir,
    // Remotion's own page has a #root; ours is #film so the two never clash.
    css: p.css.replace(/#root\b/g, "#film"),
    body: p.body,
    plan: p.plan,
    gls: p.gls,
  };
  const tween = readFileSync(path.join(here, "..", "..", "lib", "tween.js"), "utf8");
  const files = {
    "package.json": `${JSON.stringify({ name: "video-render", private: true, version: "0.0.0" }, null, 2)}\n`,
    "tsconfig.json": `${JSON.stringify(
      {
        compilerOptions: {
          jsx: "react-jsx",
          allowJs: true,
          resolveJsonModule: true,
          module: "esnext",
          moduleResolution: "bundler",
          target: "es2020",
          skipLibCheck: true,
        },
      },
      null,
      2,
    )}\n`,
    "src/index.ts": read("index.ts"),
    "src/Root.tsx": read("Root.tsx"),
    "src/Film.tsx": read("Film.tsx"),
    "src/runtime.js": read("runtime.mjs"),
    "src/tween.js": tween,
    "src/film.json": `${JSON.stringify(film).replace(/</g, "\\u003c")}\n`,
  };
  const inPublic = (m) => ({ ...m, to: `public/${m.to}` });
  return {
    files,
    media: p.media.map(inPublic),
    fonts: p.fonts.map(inPublic),
    notes: p.notes,
    size: p.size,
    frames,
  };
}
