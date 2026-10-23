import { describe, expect, it } from "vitest";
import { getRepoMeta, getSkillMarkdown, githubTreeUrl, skillMdUrl } from "./github";

const json =
  (body: unknown, status = 200) =>
  async () =>
    new Response(JSON.stringify(body), { status });
const skill = { repo: "o/r", path: "skills/x" };

describe("getRepoMeta", () => {
  it("returns stars and last push", async () => {
    const meta = await getRepoMeta("o/r", {
      fetch: json({ stargazers_count: 42, pushed_at: "2026-01-02T00:00:00Z" }),
    });
    expect(meta).toEqual({ stars: 42, pushedAt: "2026-01-02T00:00:00Z" });
  });
  it("sends the token when given", async () => {
    let auth: string | undefined;
    await getRepoMeta("o/r", {
      token: "t0k",
      fetch: async (_url, init) => {
        auth = (init?.headers as Record<string, string>).Authorization;
        return new Response("{}", { status: 500 });
      },
    });
    expect(auth).toBe("Bearer t0k");
  });
  it("returns undefined on rate limit, bad payload or network failure", async () => {
    expect(
      await getRepoMeta("o/r", { fetch: json({ message: "rate limited" }, 403) }),
    ).toBeUndefined();
    expect(await getRepoMeta("o/r", { fetch: json({ nope: 1 }) })).toBeUndefined();
    expect(
      await getRepoMeta("o/r", {
        fetch: async () => {
          throw new Error("offline");
        },
      }),
    ).toBeUndefined();
  });
});

describe("getSkillMarkdown", () => {
  const ok = (text: string) => async () => new Response(text, { status: 200 });
  it("strips frontmatter", async () => {
    expect(
      await getSkillMarkdown(skill, "a".repeat(40), { fetch: ok("---\nname: x\n---\n# Hello\n") }),
    ).toBe("# Hello\n");
  });
  it("returns the text when there is no frontmatter", async () => {
    expect(await getSkillMarkdown(skill, "a".repeat(40), { fetch: ok("# Hi") })).toBe("# Hi");
  });
  it("returns undefined on 404 or failure", async () => {
    expect(
      await getSkillMarkdown(skill, "a".repeat(40), {
        fetch: async () => new Response("", { status: 404 }),
      }),
    ).toBeUndefined();
    expect(
      await getSkillMarkdown(skill, "a".repeat(40), {
        fetch: async () => {
          throw new Error("x");
        },
      }),
    ).toBeUndefined();
  });
});

describe("urls", () => {
  it("builds raw and tree URLs, including repo-root skills", () => {
    expect(skillMdUrl(skill, "abc")).toBe(
      "https://raw.githubusercontent.com/o/r/abc/skills/x/SKILL.md",
    );
    expect(skillMdUrl({ repo: "o/r", path: "" }, "abc")).toBe(
      "https://raw.githubusercontent.com/o/r/abc/SKILL.md",
    );
    expect(githubTreeUrl(skill, "abc")).toBe("https://github.com/o/r/tree/abc/skills/x");
    expect(githubTreeUrl({ repo: "o/r", path: "" }, "abc")).toBe("https://github.com/o/r/tree/abc");
  });
});
