import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PAUSED_VIDEO_PARTS } from "../lint-skills";
import { skillFile } from "./load";

const official = path.dirname(skillFile("video", "SKILL.md")).replace(/\/video$/, "");
const parts = readdirSync(official).filter((n) => /^video-[a-z]+$/.test(n));
const text = (f: string) => readFileSync(skillFile("video", f), "utf8");
const routing = [
  "references/choose.md",
  "references/explain.md",
  "references/kids.md",
  "references/story.md",
  "references/localize.md",
]
  .map(text)
  .join("\n");

describe("the video director", () => {
  it("is one visible command and every part is Claude-only", () => {
    const fm = (name: string) =>
      /^---\n([\s\S]*?)\n---/.exec(
        readFileSync(path.join(official, name, "SKILL.md"), "utf8"),
      )![1]!;
    expect(fm("video")).not.toMatch(/user-invocable: false|disable-model-invocation/);
    for (const part of parts) {
      expect(fm(part), part).toMatch(/^user-invocable: false$/m);
      // Paused parts (kids' cartoons, drawing characters) are off for Claude too.
      if (PAUSED_VIDEO_PARTS.includes(part))
        expect(fm(part), part).toMatch(/^disable-model-invocation: true$/m);
      else expect(fm(part), part).not.toMatch(/disable-model-invocation/);
    }
  });

  it("names every part somewhere in its routing, so no part is forgotten", () => {
    // video-core, voice, captions, qa, write... are used inside the chains; the rest are in the table.
    for (const part of parts)
      expect(routing, `${part} is not mentioned in the routing`).toContain(part);
  });

  it("never asks the user to type a part's name as a command", () => {
    const skill = text("SKILL.md");
    for (const part of parts) expect(skill).not.toContain(`/${part}`);
    expect(routing).not.toMatch(/`\/video-[a-z]+/);
  });

  it("keeps the gates for money and rights in the director's steps", () => {
    const skill = text("SKILL.md");
    expect(skill).toMatch(/typed approval of that exact number/);
    expect(skill).toMatch(/never suggest one/);
    expect(skill).toMatch(/never upload/i);
  });

  it("does not offer kids' cartoons or drawing characters while they are paused", () => {
    const skill = text("SKILL.md");
    expect(skill).toMatch(/Those are paused/);
    expect(skill).not.toMatch(/follow the recipe.*kids|`kids\.md`/);
    expect(text("references/choose.md")).toMatch(/Kids \(paused\)/);
  });
});
