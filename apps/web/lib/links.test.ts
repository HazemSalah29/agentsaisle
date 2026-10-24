import { describe, expect, it } from "vitest";
import { elsewhereUrl, pairPreviews, previewCaption, previewSrc } from "./links";

describe("previewSrc", () => {
  it("points at the copied preview folder and encodes the parts", () => {
    expect(previewSrc("design-motion-portfolio", "01-hero.jpg")).toBe(
      "/previews/design-motion-portfolio/01-hero.jpg",
    );
    expect(previewSrc("a b", "x y.png")).toBe("/previews/a%20b/x%20y.png");
  });
});

describe("previewCaption", () => {
  it("turns a file name into a readable caption", () => {
    expect(previewCaption("04-work-gallery-scrolling.jpg")).toBe("Work gallery scrolling");
    expect(previewCaption("09-phone-hero.jpg")).toBe("Phone hero");
    expect(previewCaption("hero.png")).toBe("Hero");
  });
});

describe("elsewhereUrl", () => {
  it("links to the skill's folder on GitHub", () => {
    expect(elsewhereUrl({ repo: "o/r", path: "skills/x" })).toBe(
      "https://github.com/o/r/tree/HEAD/skills/x",
    );
  });
  it("links to the repo when there is no folder, and encodes odd characters", () => {
    expect(elsewhereUrl({ repo: "o/r", path: "" })).toBe("https://github.com/o/r");
    expect(elsewhereUrl({ repo: "o/r", path: "a b/c" })).toBe(
      "https://github.com/o/r/tree/HEAD/a%20b/c",
    );
  });
});

describe("pairPreviews", () => {
  it("pairs -en and -ar files in listed order", () => {
    expect(
      pairPreviews(["01-home-en.jpg", "01-home-ar.jpg", "02-pricing-en.jpg", "02-pricing-ar.jpg"]),
    ).toEqual([
      { base: "01-home", en: "01-home-en.jpg", ar: "01-home-ar.jpg" },
      { base: "02-pricing", en: "02-pricing-en.jpg", ar: "02-pricing-ar.jpg" },
    ]);
  });

  it("gives up when any file is not part of a complete pair", () => {
    expect(pairPreviews(["01-hero.jpg", "02-features.jpg"])).toBeUndefined();
    expect(pairPreviews(["01-home-en.jpg"])).toBeUndefined();
    expect(pairPreviews(["01-home-en.jpg", "01-home-ar.jpg", "extra.jpg"])).toBeUndefined();
    expect(pairPreviews([])).toBeUndefined();
  });
});
