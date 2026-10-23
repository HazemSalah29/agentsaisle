import { describe, expect, it } from "vitest";
import { reportUrl, resolveSiteUrl } from "./site";

describe("resolveSiteUrl", () => {
  it("prefers SITE_URL and trims a trailing slash", () => {
    expect(
      resolveSiteUrl({
        SITE_URL: "https://example.dev/",
        VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app",
      }),
    ).toBe("https://example.dev");
  });
  it("uses the Vercel production address when SITE_URL is missing or empty", () => {
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "agentsaisle-vercel.vercel.app" })).toBe(
      "https://agentsaisle-vercel.vercel.app",
    );
    expect(
      resolveSiteUrl({
        SITE_URL: "",
        VERCEL_PROJECT_PRODUCTION_URL: "agentsaisle-vercel.vercel.app",
      }),
    ).toBe("https://agentsaisle-vercel.vercel.app");
  });
  it("falls back to localhost for development", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });
});

describe("reportUrl", () => {
  it("opens the issue template with the skill prefilled and encoded", () => {
    const url = new URL(reportUrl("my skill"));
    expect(url.pathname).toBe("/HazemSalah29/agentsaisle/issues/new");
    expect(url.searchParams.get("template")).toBe("report-skill.yml");
    expect(url.searchParams.get("skill")).toBe("my skill");
  });
});
