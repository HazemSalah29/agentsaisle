export const REPO_URL = "https://github.com/HazemSalah29/agentsaisle";

/**
 * The site's public origin, for the sitemap, robots.txt and social images. Order: SITE_URL, then the
 * production address Vercel provides (which becomes the custom domain once one is attached), then
 * localhost for development. Empty values count as unset.
 */
export function resolveSiteUrl(env: Record<string, string | undefined>): string {
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined;
  return (env.SITE_URL || vercel || "http://localhost:3000").replace(/\/$/, "");
}

export const SITE_URL = resolveSiteUrl(process.env);

export const reportUrl = (skillName: string) =>
  `${REPO_URL}/issues/new?template=report-skill.yml&title=${encodeURIComponent(`Report: ${skillName}`)}&skill=${encodeURIComponent(skillName)}`;
