import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ok = vi.hoisted(() => ({ value: true }));
vi.mock("../src/components/kit/use-motion-ok", () => ({ useMotionOk: () => ok.value }));

import {
  Container,
  HeroKinetic,
  MagneticButton,
  RevealText,
  Section,
  SiteShell,
} from "../src/components/kit";

beforeEach(() => {
  ok.value = true;
});

describe("RevealText", () => {
  it("splits a string into words and keeps the full text for screen readers", () => {
    const html = renderToString(<RevealText text="Make it move" />);
    expect(html).toContain('<span class="sr-only">Make it move</span>');
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(3);
  });

  it("treats an array as lines", () => {
    const html = renderToString(<RevealText text={["One line", "Two"]} />);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
    expect(html).toContain("One line");
  });

  it("starts hidden below its mask when motion is allowed", () => {
    expect(renderToString(<RevealText text="Hi" />)).toContain("translateY(110%)");
  });

  it("renders in place, with nothing hidden, when reduced motion is on", () => {
    ok.value = false;
    expect(renderToString(<RevealText text="Hi there" />)).not.toContain("translateY");
  });

  it("renders the element given by `as`", () => {
    expect(renderToString(<RevealText as="h2" text="Title" />)).toMatch(/^<h2/);
  });
});

describe("HeroKinetic", () => {
  const props = { lines: ["Big", "Words"], intro: "Intro copy", media: <img alt="plate" /> };

  it("renders the headline as a single h1 with every line", () => {
    const html = renderToString(<HeroKinetic {...props} />);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Big Words");
    expect(html).toContain("Intro copy");
  });

  it("covers the media with a curtain when motion is allowed", () => {
    expect(renderToString(<HeroKinetic {...props} />)).toContain("data-kit-curtain");
  });

  it("has no curtain when reduced motion is on", () => {
    ok.value = false;
    const html = renderToString(<HeroKinetic {...props} />);
    expect(html).not.toContain("data-kit-curtain");
    expect(html).toContain('alt="plate"');
  });

  it("omits the media column and actions when not given", () => {
    const html = renderToString(<HeroKinetic lines={["A"]} intro="b" />);
    expect(html).not.toContain("data-kit-curtain");
  });
});

describe("MagneticButton", () => {
  it("renders a link when given href", () => {
    const html = renderToString(<MagneticButton href="/work">Work</MagneticButton>);
    expect(html).toMatch(/<a [^>]*href="\/work"/);
  });

  it("renders a button otherwise", () => {
    expect(renderToString(<MagneticButton>Go</MagneticButton>)).toMatch(
      /<button [^>]*type="button"/,
    );
  });

  it("uses the outline variant", () => {
    expect(renderToString(<MagneticButton variant="outline">Go</MagneticButton>)).toContain(
      "border-ink",
    );
  });
});

describe("layout and shell", () => {
  it("Section and Container pass props through", () => {
    const html = renderToString(
      <Section id="a" className="extra">
        <Container data-x="1">hi</Container>
      </Section>,
    );
    expect(html).toContain('id="a"');
    expect(html).toContain("py-section extra");
    expect(html).toContain("max-w-page");
    expect(html).toContain('data-x="1"');
  });

  it("SiteShell renders its children and a no-JavaScript fallback", () => {
    const html = renderToString(<SiteShell>child</SiteShell>);
    expect(html).toContain("child");
    expect(html).toContain("<noscript>");
  });
});
