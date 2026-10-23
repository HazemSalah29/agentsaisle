// Publishes the compiled registry as a static file at /registry.json.
import { copyFile, mkdir } from "node:fs/promises";
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
