// Publishes the compiled registry as a static file at /registry.json.
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../../../registry/dist/registry.json");
const dest = path.resolve(here, "../public/registry.json");

await mkdir(path.dirname(dest), { recursive: true });
await copyFile(src, dest).catch(() => {
  throw new Error(
    `Missing ${src}. Run "pnpm registry:build" first (turbo does this automatically).`,
  );
});
console.log("web: copied registry.json to public/");

// Screenshots for skill pages: registry/official/<name>/preview/* is served at /previews/<name>/*.
const officialDir = path.resolve(here, "../../../registry/official");
const previewsOut = path.resolve(here, "../public/previews");
await rm(previewsOut, { recursive: true, force: true });
let copied = 0;
for (const skill of await readdir(officialDir, { withFileTypes: true })) {
  if (!skill.isDirectory()) continue;
  const from = path.join(officialDir, skill.name, "preview");
  const files = (await readdir(from).catch(() => [])).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  if (files.length === 0) continue;
  await mkdir(path.join(previewsOut, skill.name), { recursive: true });
  for (const f of files) {
    await copyFile(path.join(from, f), path.join(previewsOut, skill.name, f));
    copied++;
  }
}
console.log(`web: copied ${copied} preview images to public/previews/`);

// Stored audit reports: registry/dist/audits/<name>@<version>.json is served at /audits/<name>@<version>.json.
const auditsSrc = path.resolve(here, "../../../registry/dist/audits");
const auditsOut = path.resolve(here, "../public/audits");
await rm(auditsOut, { recursive: true, force: true });
await mkdir(auditsOut, { recursive: true });
let reports = 0;
for (const f of (await readdir(auditsSrc).catch(() => [])).filter((n) => n.endsWith(".json"))) {
  await copyFile(path.join(auditsSrc, f), path.join(auditsOut, f));
  reports++;
}
console.log(`web: copied ${reports} audit reports to public/audits/`);

// shields.io endpoint badges: registry/dist/badges/<name>.json is served at /badges/<name>.json.
const badgesSrc = path.resolve(here, "../../../registry/dist/badges");
const badgesOut = path.resolve(here, "../public/badges");
await rm(badgesOut, { recursive: true, force: true });
await mkdir(badgesOut, { recursive: true });
let badges = 0;
for (const f of (await readdir(badgesSrc).catch(() => [])).filter((n) => n.endsWith(".json"))) {
  await copyFile(path.join(badgesSrc, f), path.join(badgesOut, f));
  badges++;
}
console.log(`web: copied ${badges} badges to public/badges/`);

// Live demos: registry/official/<name>/evals/demo/<id>.architecture.json is rendered with the skill's own
// render script to /demos/<name>/<id>.html, so a demo always uses the current viewer. A model that does not
// render fails the build: the models live in this repository, so that is a bug to fix, not to skip.
const demosOut = path.resolve(here, "../public/demos");
await rm(demosOut, { recursive: true, force: true });
let demos = 0;
for (const skill of await readdir(officialDir, { withFileTypes: true })) {
  if (!skill.isDirectory()) continue;
  const demoDir = path.join(officialDir, skill.name, "evals", "demo");
  const models = (await readdir(demoDir).catch(() => [])).filter((f) =>
    f.endsWith(".architecture.json"),
  );
  if (models.length === 0) continue;
  const renderFile = path.join(officialDir, skill.name, "scripts", "render.mjs");
  const { renderPage } = (await import(pathToFileURL(renderFile).href)) as {
    renderPage: (model: unknown) => string;
  };
  await mkdir(path.join(demosOut, skill.name), { recursive: true });
  for (const f of models) {
    const model = JSON.parse(await readFile(path.join(demoDir, f), "utf8"));
    const html = renderPage(model);
    await writeFile(
      path.join(demosOut, skill.name, f.replace(/\.architecture\.json$/, ".html")),
      html,
    );
    demos++;
  }
}
console.log(`web: rendered ${demos} live demo page(s) to public/demos/`);
