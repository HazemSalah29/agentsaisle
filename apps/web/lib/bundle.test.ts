import type { Question } from "@agentsaisle/registry-schema";
import { describe, expect, it } from "vitest";
import { buildBundle } from "./bundle";

const questions: Question[] = [
  {
    id: "focus",
    prompt: "?",
    options: [
      { label: "Software", adds: ["explore", "implement"] },
      { label: "Docs", adds: ["edit"] },
    ],
  },
  {
    id: "start",
    prompt: "?",
    options: [
      { label: "Plan", adds: ["plan"] },
      { label: "Just start", adds: [] },
    ],
  },
  {
    id: "eyes",
    prompt: "?",
    options: [
      { label: "Yes", adds: ["review", "explore"] },
      { label: "No", adds: [] },
    ],
  },
];
const all = ["plan", "implement", "explore", "review", "edit"];

describe("buildBundle", () => {
  it("is empty with no answers", () => {
    expect(buildBundle(questions, {}, all)).toEqual([]);
  });
  it("unions the chosen options in order of first appearance", () => {
    expect(buildBundle(questions, { focus: 0, start: 0, eyes: 0 }, all)).toEqual([
      "explore",
      "implement",
      "plan",
      "review",
    ]);
  });
  it("does not repeat a skill added by two answers", () => {
    const bundle = buildBundle(questions, { focus: 0, eyes: 0 }, all);
    expect(bundle.filter((s) => s === "explore")).toHaveLength(1);
  });
  it("ignores unanswered questions and empty options", () => {
    expect(buildBundle(questions, { start: 1, focus: 1 }, all)).toEqual(["edit"]);
  });
  it("drops skills that are not in the registry", () => {
    expect(buildBundle(questions, { focus: 0 }, ["explore"])).toEqual(["explore"]);
  });
  it("ignores an out-of-range choice instead of crashing", () => {
    expect(buildBundle(questions, { focus: 9 }, all)).toEqual([]);
  });
});
