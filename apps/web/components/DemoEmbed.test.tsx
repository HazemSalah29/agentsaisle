import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DemoEmbed } from "./DemoEmbed";

const steps = [
  { title: "Discover", text: "A script finds the parts." },
  { title: "Render", text: "One offline file." },
];

describe("DemoEmbed", () => {
  const html = renderToStaticMarkup(
    <DemoEmbed
      url="/demos/arch-visualize/devpath.html"
      title="Example"
      caption="A real project."
      steps={steps}
    />,
  );

  it("frames the page with scripts only, lazily, and without a referrer", () => {
    const frame = /<iframe[^>]*>/.exec(html)![0];
    expect(frame).toContain('src="/demos/arch-visualize/devpath.html"');
    expect(frame).toContain('sandbox="allow-scripts"');
    expect(frame).not.toMatch(/allow-same-origin|allow-top-navigation|allow-popups|allow-forms/);
    expect(frame).toContain('loading="lazy"');
    expect(frame).toMatch(/referrerpolicy="no-referrer"/i);
    expect(frame).toContain('title="Example"');
  });

  it("offers a full-screen link that opens safely in a new tab", () => {
    const link = /<a[^>]*>Open full screen<\/a>/.exec(html)![0];
    expect(link).toContain('href="/demos/arch-visualize/devpath.html"');
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
  });

  it("shows the project text and the numbered steps in order", () => {
    expect(html).toContain("A real project.");
    expect(html.indexOf("Discover")).toBeLessThan(html.indexOf("Render"));
    expect(html).toContain("01");
    expect(html).toContain("02");
    expect(html).toContain("How /arch-visualize mapped it");
  });

  it("omits the steps heading when there are none", () => {
    const bare = renderToStaticMarkup(<DemoEmbed url="/d.html" title="t" />);
    expect(bare).not.toContain("How /arch-visualize mapped it");
    expect(bare).toContain("<iframe");
  });
});
