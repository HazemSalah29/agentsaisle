import type { MetadataRoute } from "next";
import { getRegistry } from "../lib/registry";
import { SITE_URL } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date(getRegistry().generatedAt);
  return [
    { url: `${SITE_URL}/`, lastModified: now },
    { url: `${SITE_URL}/skills`, lastModified: now },
    { url: `${SITE_URL}/docs`, lastModified: now },
    { url: `${SITE_URL}/profiles`, lastModified: now },
    { url: `${SITE_URL}/submit`, lastModified: now },
    ...getRegistry().skills.map((s) => ({
      url: `${SITE_URL}/skills/${s.name}`,
      lastModified: now,
    })),
  ];
}
