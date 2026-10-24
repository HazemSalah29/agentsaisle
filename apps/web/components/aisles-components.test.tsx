import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";
import { ElsewhereCard } from "./ElsewhereCard";

describe("Badge", () => {
  it("has a label and an icon, so it does not rely on color alone", () => {
    const html = renderToStaticMarkup(<Badge kind="scripts" />);
    expect(html).toContain("Runs scripts");
    expect(html).toContain("<svg");
  });
  it("no longer has an untested state", () => {
    expect(renderToStaticMarkup(<Badge kind="official" />)).not.toMatch(/untested/i);
  });
});

describe("ElsewhereCard", () => {
  const entry = {
    name: "frontend-design",
    author: "Someone",
    repo: "o/r",
    path: "skills/frontend-design",
    description: "A short line.",
    license: "Apache-2.0",
    aisle: "web-design",
  };

  it("links out to GitHub safely and shows the author and license", () => {
    const html = renderToStaticMarkup(<ElsewhereCard entry={entry} />);
    expect(html).toContain('href="https://github.com/o/r/tree/HEAD/skills/frontend-design"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Someone");
    expect(html).toContain("Apache-2.0");
    expect(html).toContain("Open on GitHub");
  });

  it("never offers an install command", () => {
    const html = renderToStaticMarkup(<ElsewhereCard entry={entry} />);
    expect(html).not.toMatch(/npx|aisle add|install/i);
  });
});
