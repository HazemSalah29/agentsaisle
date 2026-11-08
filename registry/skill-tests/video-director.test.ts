import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skillFile } from "./load";

const official = path.dirname(skillFile("video", "SKILL.md")).replace(/\/video$/, "");
const parts = readdirSync(official).filter((n) => /^video-[a-z]+$/.test(n));
const text = (f: string) => readFileSync(skillFile("video", f), "utf8");
const routing = [
  "references/choose.md",
  "references/explain.md",
  "references/kinetic.md",
  "references/showcase.md",
  "references/reel.md",
  "references/craft.md",
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
      expect(fm(part), part).not.toMatch(/disable-model-invocation/);
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

  it("keeps the gates for installs, rights and uploads in the director's steps", () => {
    const skill = text("SKILL.md");
    expect(skill).toMatch(/Never install anything yourself/);
    expect(skill).toMatch(/never read or ask for an API key/);
    expect(skill).toMatch(/Never upload/);
    expect(skill).toMatch(/Pause for the user only at/);
  });

  it("offers exactly four formats and says what is not offered", () => {
    const skill = text("SKILL.md");
    const choose = text("references/choose.md");
    for (const f of ["Explainer", "Kinetic", "Showcase", "Reel"])
      expect(choose).toContain(`| ${f}`);
    expect(choose).toMatch(/Not offered/);
    expect(skill + routing).not.toMatch(/video-kids|puppet|Higgsfield|HyperFrames/);
  });

  it("holds every video to the craft page and its score card", () => {
    const craft = text("references/craft.md");
    for (const line of ["Hook", "Clarity", "Pace", "Variety", "Polish", "Payoff"])
      expect(craft).toContain(`| ${line}`);
    expect(text("SKILL.md")).toMatch(/references\/craft\.md/);
  });
});
