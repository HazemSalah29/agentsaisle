import { describe, expect, it } from "vitest";
import { previewCaption, previewSrc } from "./links";

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
