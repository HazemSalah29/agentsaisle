import { splitFrontmatter, type RegistrySkill } from "@agentsaisle/registry-schema";

type Fetch = (
  url: string,
  init?: RequestInit & { next?: { revalidate: number } },
) => Promise<Response>;

export interface RepoMeta {
  stars: number;
  /** ISO date of the last push. */
  pushedAt: string;
}

const HOUR = 3600;

/**
 * Stars and last-updated date for a repo. Uses GITHUB_TOKEN when set. Returns undefined on any
 * failure (no token, rate limit, network), so the site simply renders without these numbers.
 */
export async function getRepoMeta(
  repo: string,
  opts: { token?: string; fetch?: Fetch } = {},
): Promise<RepoMeta | undefined> {
  const doFetch = opts.fetch ?? fetch;
  const token = opts.token ?? process.env.GITHUB_TOKEN;
  try {
    const res = await doFetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: HOUR },
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { stargazers_count?: unknown; pushed_at?: unknown };
    if (typeof body.stargazers_count !== "number" || typeof body.pushed_at !== "string")
      return undefined;
    return { stars: body.stargazers_count, pushedAt: body.pushed_at };
  } catch {
    return undefined;
  }
}

export function skillMdUrl(skill: Pick<RegistrySkill, "repo" | "path">, sha: string): string {
  return `https://raw.githubusercontent.com/${skill.repo}/${sha}/${skill.path ? skill.path + "/" : ""}SKILL.md`;
}

/** The SKILL.md body (frontmatter removed) at a pinned SHA, or undefined if it can't be loaded. */
export async function getSkillMarkdown(
  skill: Pick<RegistrySkill, "repo" | "path">,
  sha: string,
  opts: { fetch?: Fetch } = {},
): Promise<string | undefined> {
  const doFetch = opts.fetch ?? fetch;
  try {
    const res = await doFetch(skillMdUrl(skill, sha), { next: { revalidate: HOUR } });
    if (!res.ok) return undefined;
    const text = await res.text();
    return splitFrontmatter(text)?.body ?? text;
  } catch {
    return undefined;
  }
}

export const githubTreeUrl = (skill: Pick<RegistrySkill, "repo" | "path">, sha: string) =>
  `https://github.com/${skill.repo}/tree/${sha}${skill.path ? "/" + skill.path : ""}`;
