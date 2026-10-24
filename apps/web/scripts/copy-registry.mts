// Publishes the compiled registry as a static file at /registry.json.
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
