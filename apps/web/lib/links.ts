import type { RegistrySkill } from "@agentsaisle/registry-schema";

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * Make a link from community markdown safe and useful. Relative links become GitHub URLs at the
 * pinned SHA (and may not leave that commit's file tree); anchors stay; anything with an unusual scheme
 * (javascript:, data:, ...) is dropped.
 */
export function resolveHref(
  href: string | undefined,
  skill: Pick<RegistrySkill, "repo" | "path">,
  sha: string,
): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("#")) return href;
  const base = `https://github.com/${skill.repo}/blob/${sha}/${skill.path ? skill.path + "/" : ""}`;
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return undefined;
  }
  if (!SAFE_SCHEMES.has(url.protocol)) return undefined;
  const isRelative = !/^[a-z][a-z0-9+.-]*:/i.test(href);
  if (isRelative && !url.href.startsWith(`https://github.com/${skill.repo}/blob/${sha}/`))
    return undefined;
  return url.href;
}
