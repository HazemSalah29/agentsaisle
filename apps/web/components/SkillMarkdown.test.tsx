import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveHref } from "../lib/links";
import { SkillMarkdown } from "./SkillMarkdown";

const skill = { repo: "o/r", path: "skills/x" };
const sha = "a".repeat(40);
const render = (md: string) =>
  renderToStaticMarkup(<SkillMarkdown source={md} skill={skill} sha={sha} />);

describe("SkillMarkdown", () => {
  it("renders basic markdown", () => {
    const html = render("## Steps\n\n- one\n- **two**\n\n`code`");
    expect(html).toContain("<h3>Steps</h3>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<strong>two</strong>");
  });
  it("demotes headings so the page keeps a single h1", () => {
    expect(render("# Title")).toContain("<h2>Title</h2>");
    expect(render("# Title")).not.toContain("<h1");
  });
  it("never renders raw HTML, scripts or event handlers", () => {
    const html = render(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n<div onclick="x()">hi</div>',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<img");
  });
  it("drops javascript: and data: links but keeps the text", () => {
    const html = render(
      "[bad](javascript:alert(1)) [data](data:text/html,x) [ok](https://example.com)",
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text");
    expect(html).toContain("bad");
    expect(html).toContain('href="https://example.com/"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
  it("shows alt text instead of loading images", () => {
    const html = render("![diagram](https://evil.example/x.png)");
    expect(html).not.toContain("<img");
    expect(html).toContain("[image: diagram]");
  });
  it("rewrites relative links to the pinned commit", () => {
    expect(render("[ref](references/a.md)")).toContain(
      `href="https://github.com/o/r/blob/${sha}/skills/x/references/a.md"`,
    );
  });
});

describe("resolveHref", () => {
  it("keeps anchors and absolute http(s) and mailto links", () => {
    expect(resolveHref("#top", skill, sha)).toBe("#top");
    expect(resolveHref("https://a.dev/x", skill, sha)).toBe("https://a.dev/x");
    expect(resolveHref("mailto:a@b.dev", skill, sha)).toBe("mailto:a@b.dev");
  });
  it("resolves relative links inside the repo and refuses to escape it", () => {
    expect(resolveHref("../y/SKILL.md", skill, sha)).toBe(
      `https://github.com/o/r/blob/${sha}/skills/y/SKILL.md`,
    );
    expect(resolveHref("../../../../other/repo", skill, sha)).toBeUndefined();
  });
  it("drops unsafe schemes and empty links", () => {
    expect(resolveHref("javascript:alert(1)", skill, sha)).toBeUndefined();
    expect(resolveHref("vbscript:x", skill, sha)).toBeUndefined();
    expect(resolveHref(undefined, skill, sha)).toBeUndefined();
  });
});
