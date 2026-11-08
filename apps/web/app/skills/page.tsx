import type { Metadata } from "next";
import { Catalog } from "../../components/Catalog";
import { PageIntro } from "../../components/simple/PageIntro";
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
      <PageIntro
        size="lg"
        eyebrow="Catalog"
        lines={["Find a skill"]}
        accent="then add it in one line."
        intro="Search by name or by what you want to do. Every skill is checked and gets a grade."
      />
      <Catalog skills={skills} />
    </>
  );
}
