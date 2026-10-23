import { RegistryIndex } from "@agentsaisle/registry-schema";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const revalidate = 3600;

export default async function Home() {
  const raw = await readFile(path.join(process.cwd(), "public", "registry.json"), "utf8");
  const index = RegistryIndex.parse(JSON.parse(raw));
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Agent Aisle</h1>
      <p className="mt-2">A store for Agent Skills. {index.skills.length} skills on the shelves.</p>
      <p className="mt-4 font-mono text-sm">npx @agentsaisle/cli add explore</p>
    </main>
  );
}
