import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/demos-data", () => ({
  getDemos: () => ({
    demos: [
      {
        id: "incident",
        title: "A checkout slowdown",
        type: "Incident replay",
        prompt: "Make an incident replay video from this postmortem.",
        summary: "A <b>timeline</b>.",
        note: "The incident is fictional.",
        video: "incident.mp4",
        poster: "poster.jpg",
        sources: ["video.json"],
        files: ["video.json"],
        qa: { ok: true, warnings: 0, failures: 0, seconds: 35, size: "1080x1920" },
      },
    ],
    coming: [{ id: "story", title: "Story from stills", why: "Needs a paid provider." }],
  }),
}));

import DemosPage from "./page";

describe("demos page", () => {
  const html = renderToStaticMarkup(<DemosPage />);
  it("shows each video with its poster, source links and honest QA wording", () => {
    expect(html).toContain('src="/video-demos/incident/incident.mp4"');
    expect(html).toContain('poster="/video-demos/incident/poster.jpg"');
    expect(html).toContain('preload="none"');
    expect(html).toContain('href="/video-demos/incident/video.json"');
    expect(html).toContain("QA passed, no warnings");
    expect(html).toContain("35 s");
    expect(html).toContain("The incident is fictional.");
    expect(html).toContain("/video Make an incident replay video from this postmortem.");
    expect(html).toContain("does not judge whether a video is any good");
  });
  it("escapes text and lists what is not shown", () => {
    expect(html).not.toContain("<b>timeline</b>");
    expect(html).toContain("Story from stills");
    expect(html).toContain("Needs a paid provider.");
    expect(html).toContain("Voices are computer-generated");
  });
});
