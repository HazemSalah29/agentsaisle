import { compareSemver } from "@agentsaisle/registry-schema";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimpleSkillPage } from "../../../components/simple/SimpleSkillPage";
import { getRepoMeta, getSkillMarkdown, githubTreeUrl } from "../../../lib/github";
import { libraryOfPart, partsOfLibrary } from "../../../lib/library";
import { getRegistry, getSkill } from "../../../lib/registry";

export const revalidate = 3600;
export const dynamicParams = false;

type Props = { params: Promise<{ name: string }> };

export function generateStaticParams() {
  return getRegistry().skills.map((s) => ({ name: s.name }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const skill = getSkill((await params).name);
  if (!skill) return {};
  return {
    title: skill.name,
    description: skill.description,
    openGraph: { title: `${skill.name} on Agent Aisle`, description: skill.description },
  };
}

const clientNames: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

export default async function SkillPage({ params }: Props) {
  const skill = getSkill((await params).name);
  if (!skill) notFound();

  const versions = [...skill.versions].sort((a, b) => compareSemver(b.version, a.version));
  const latest = versions[0]!;
  const owner = skill.repo.split("/")[0]!;
  const [markdown, meta] = await Promise.all([
    getSkillMarkdown(skill, latest.sha),
    getRepoMeta(skill.repo),
  ]);

  const facts: Array<[string, React.ReactNode]> = [
    [
      "Author",
      <a key="a" href={`https://github.com/${owner}`} rel="noopener noreferrer">
        {skill.author}
      </a>,
    ],
    ["Latest", `v${skill.latest}`],
    ["Aisle", skill.category.join(", ")],
    ["Works with", skill.clients.map((c) => clientNames[c] ?? c).join(", ")],
    [
      "Source",
      <a key="s" href={githubTreeUrl(skill, latest.sha)} rel="noopener noreferrer">
        {skill.repo}
      </a>,
    ],
    ...(meta ? ([["Stars", meta.stars.toLocaleString("en-US")]] as Array<[string, string]>) : []),
  ];

  const registry = getRegistry();
  return (
    <SimpleSkillPage
      skill={skill}
      versions={versions}
      latestSha={latest.sha}
      markdown={markdown}
      facts={facts}
      parts={partsOfLibrary(registry, skill)}
      library={libraryOfPart(registry, skill)}
    />
  );
}
