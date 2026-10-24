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

/** Public path of a skill's preview screenshot (copied from registry/official/<name>/preview/). */
export function previewSrc(skill: string, file: string): string {
  return `/previews/${encodeURIComponent(skill)}/${encodeURIComponent(file)}`;
}

/** Caption from a preview file name: "04-work-gallery-scrolling.jpg" becomes "Work gallery scrolling". */
export function previewCaption(file: string): string {
  const words = file
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/^\d+[-_]/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : file;
}

/** Where an Elsewhere entry lives on GitHub. The folder, or the repo root when the path is empty. */
export function elsewhereUrl(entry: { repo: string; path: string }): string {
  const tail = entry.path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return tail
    ? `https://github.com/${entry.repo}/tree/HEAD/${tail}`
    : `https://github.com/${entry.repo}`;
}
