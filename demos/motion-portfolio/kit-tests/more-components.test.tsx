import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ok = vi.hoisted(() => ({ value: true }));
vi.mock("../src/components/kit/use-motion-ok", () => ({ useMotionOk: () => ok.value }));

import {
  BlogGrid,
  ContactCTA,
  Footer,
  Grid,
  Marquee,
  NavOverlay,
  PageEnter,
  ProjectCard,
  Section,
  ServiceList,
  SiteShell,
  StatCounter,
  WorkGallery,
} from "../src/components/kit";

const image = { src: "/a.svg", alt: "plate", width: 1200, height: 900 };
const project = {
  title: "Harbour",
  client: "H",
  year: "2026",
  category: "Motion",
  href: "/w",
  image,
};

beforeEach(() => {
  ok.value = true;
});

describe("Marquee", () => {
  it("repeats its content once, hidden from screen readers, and marks it for reduced motion", () => {
    const html = renderToString(<Marquee>Words</Marquee>);
    expect(html.match(/Words/g)).toHaveLength(2);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("data-kit-motion");
  });

  it("takes its loop time from the speed token and can run right", () => {
    const html = renderToString(
      <Marquee speed="fast" direction="right">
        x
      </Marquee>,
    );
    expect(html).toContain("var(--marquee-fast)");
    expect(html).toContain("animation-direction:reverse");
  });

  it("can ignore hover", () => {
    expect(renderToString(<Marquee pauseOnHover={false}>x</Marquee>)).not.toContain(
      "animation-play-state",
    );
  });
});

describe("StatCounter", () => {
  it("renders the final number and label on the server, so it works without JavaScript", () => {
    const html = renderToString(<StatCounter value={97} suffix="%" label="score" />);
    expect(html).toContain("97");
    expect(html).toContain("score");
    expect(html).toContain("%");
  });
});

describe("NavOverlay", () => {
  const links = [
    { label: "Work", href: "/work" },
    { label: "About", href: "/about" },
  ];

  it("shows a closed menu button and the brand, with no menu links yet", () => {
    const html = renderToString(<NavOverlay brand="Lowtide" links={links} available="Booking" />);
    expect(html).toContain("Lowtide");
    expect(html).toContain("Booking");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("/about");
  });

  it("hides the availability pill when not given", () => {
    expect(renderToString(<NavOverlay brand="L" links={links} />)).not.toContain(
      "rounded-full border border-ink px-4",
    );
  });
});

describe("ServiceList", () => {
  it("numbers the rows from 01 in order", () => {
    const html = renderToString(
      <ServiceList
        services={[
          { title: "One", description: "a" },
          { title: "Two", description: "b" },
        ]}
      />,
    );
    expect(html.indexOf("01")).toBeLessThan(html.indexOf("02"));
    expect(html).toContain("<ol");
  });
});

describe("ProjectCard", () => {
  it("links to the project and shows its meta and a lazy image with dimensions", () => {
    const html = renderToString(<ProjectCard project={project} />).replace(/<!-- -->/g, "");
    expect(html).toMatch(/<a [^>]*href="\/w"/);
    expect(html).toContain("H / 2026 / Motion");
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('width="1200"');
  });
});

describe("WorkGallery", () => {
  it("renders every project as a plain stack until the browser reports a wide screen", () => {
    const html = renderToString(
      <WorkGallery projects={[project, { ...project, href: "/w2", title: "Two" }]} />,
    );
    expect(html).toContain("Harbour");
    expect(html).toContain("Two");
    expect(html).not.toContain("sticky");
  });

  it("is a stack with reduced motion", () => {
    ok.value = false;
    expect(renderToString(<WorkGallery projects={[project]} />)).not.toContain("sticky");
  });
});

describe("BlogGrid, ContactCTA, Footer, Grid", () => {
  it("BlogGrid lists each post with category and date", () => {
    const html = renderToString(
      <BlogGrid
        posts={[
          { title: "Post", excerpt: "E", date: "1 May", category: "Craft", href: "/p", image },
        ]}
      />,
    );
    expect(html.replace(/<!-- -->/g, "")).toContain("Craft / 1 May");
    expect(html).toContain("<article");
    expect(html).toContain("data-kit-motion");
  });

  it("ContactCTA is a single link with an optional note", () => {
    const html = renderToString(<ContactCTA label="Talk" href="/c" note="Reply soon" />);
    expect(html).toMatch(/<a [^>]*href="\/c"/);
    expect(html).toContain("Reply soon");
    expect(renderToString(<ContactCTA label="Talk" href="/c" />)).not.toContain("<p");
  });

  it("Footer renders socials and a back-to-top button", () => {
    const html = renderToString(<Footer note="2026" socials={[{ label: "Vimeo", href: "/v" }]} />);
    expect(html).toContain("Vimeo");
    expect(html).toContain("Back to top");
  });

  it("Grid picks columns from the prop", () => {
    expect(renderToString(<Grid cols={2}>x</Grid>)).toContain("md:grid-cols-2");
    expect(renderToString(<Grid>x</Grid>)).toContain("md:grid-cols-3");
  });
});

describe("Section, PageEnter, SiteShell", () => {
  it("Section hero uses the short top pad", () => {
    expect(renderToString(<Section pad="hero">x</Section>)).toContain("pt-12 pb-8");
    expect(renderToString(<Section>x</Section>)).toContain("py-section");
  });

  it("PageEnter starts faded when motion is allowed and in place when it is not", () => {
    expect(renderToString(<PageEnter>x</PageEnter>)).toContain("opacity:0");
    ok.value = false;
    expect(renderToString(<PageEnter>x</PageEnter>)).not.toContain("opacity:0");
  });

  it("SiteShell never renders the cursor on the server", () => {
    expect(renderToString(<SiteShell cursor>x</SiteShell>)).not.toContain("bg-accent");
  });
});
