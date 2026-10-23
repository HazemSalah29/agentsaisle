export const REPO_URL = "https://github.com/HazemSalah29/agentsaisle";

/** Public origin for sitemap and social images. The domain is not final, so it comes from the environment. */
export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const reportUrl = (skillName: string) =>
  `${REPO_URL}/issues/new?template=report-skill.yml&title=${encodeURIComponent(`Report: ${skillName}`)}&skill=${encodeURIComponent(skillName)}`;
