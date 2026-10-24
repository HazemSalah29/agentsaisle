import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreviewPairs } from "./PreviewPairs";

describe("PreviewPairs", () => {
  it("shows English and Arabic screenshots side by side with labels and alt text", () => {
    const html = renderToStaticMarkup(
      <PreviewPairs
        skill="arabic-rtl"
        pairs={[{ base: "01-home", en: "01-home-en.jpg", ar: "01-home-ar.jpg" }]}
        className="grid"
        imageClass="aspect-square"
      />,
    );
    expect(html).toContain("/previews/arabic-rtl/01-home-en.jpg");
    expect(html).toContain("/previews/arabic-rtl/01-home-ar.jpg");
    expect(html).toContain('alt="Home, English"');
    expect(html).toContain('alt="Home, Arabic"');
    expect(html).toContain('lang="ar"');
    expect(html.indexOf("English")).toBeLessThan(html.lastIndexOf("Arabic"));
  });
});
