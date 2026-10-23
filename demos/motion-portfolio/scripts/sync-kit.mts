// The demo is built from the skill's kit, exactly as a user's project would be: copy
// assets/kit/ into src/components/kit/. The copy is git-ignored; the skill folder is the source.
// Milestone 9 stage 2 replaces this with the skill's own install-kit script.
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../../../registry/official/design-motion-portfolio/assets/kit");
const dest = path.resolve(here, "../src/components/kit");

await rm(dest, { recursive: true, force: true });
await cp(src, dest, { recursive: true });
console.log("demo: copied the kit to src/components/kit/");
