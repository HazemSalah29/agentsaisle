/** Markdown for the README badge of a skill: a shields.io endpoint badge that reads /badges/<name>.json. */
export function badgeMarkdown(siteUrl: string, name: string): string {
  const site = siteUrl.replace(/\/$/, "");
  const json = encodeURIComponent(`${site}/badges/${name}.json`);
  return `[![aisle audit](https://img.shields.io/endpoint?url=${json})](${site}/skills/${name})`;
}
