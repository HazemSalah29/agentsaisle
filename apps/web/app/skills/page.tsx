import type { Metadata } from "next";
import { Suspense } from "react";
import { Catalog } from "../../components/Catalog";
import { getCatalog } from "../../lib/catalog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Skills",
  description:
    "Browse and search Agent Skills for Claude Code, Codex and Cursor. Every skill installs with one command.",
};

export default async function SkillsPage() {
  const skills = await getCatalog();
  return (
    <>
      <div className="px-4 py-12 sm:px-8">
        <p className="hud-label text-accent-ink">Catalog</p>
        <h1 className="mt-3 text-3xl">Skills</h1>
        <p className="mt-3 text-muted">
          Search by name, description or aisle. Every skill pins an exact commit, and the install
          command is one line.
        </p>
      </div>
      <Suspense
        fallback={<p className="hud-label px-4 pb-14 text-muted sm:px-8">Loading skills</p>}
      >
        <Catalog skills={skills} />
      </Suspense>
    </>
  );
}
