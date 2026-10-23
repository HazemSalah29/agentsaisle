"use client";

import type { Question } from "@agentsaisle/registry-schema";
import { useMemo, useState } from "react";
import { buildBundle, type Answers } from "../lib/bundle";
import { Receipt } from "./Receipt";

export type PickerSkill = { name: string; version: string };

/** Questions on the left, the bundle printed as a receipt on the right. */
export function ProfilePicker({
  questions,
  skills,
}: {
  questions: Question[];
  skills: PickerSkill[];
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [newest, setNewest] = useState<string>();

  const versions = useMemo(() => new Map(skills.map((s) => [s.name, s.version])), [skills]);
  const bundle = useMemo(
    () => buildBundle(questions, answers, versions.keys()),
    [questions, answers, versions],
  );
  const items = bundle.map((name) => ({ name, version: versions.get(name) ?? "" }));

  function answer(id: string, choice: number) {
    const next = { ...answers, [id]: choice };
    const before = new Set(bundle);
    const added = buildBundle(questions, next, versions.keys()).filter((n) => !before.has(n));
    setAnswers(next);
    setNewest(added[0]);
  }

  const answered = Object.values(answers).filter((v) => v !== undefined).length;

  return (
    <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[1fr_26rem]">
      <form
        onSubmit={(e) => e.preventDefault()}
        aria-label="Profile questions"
        className="space-y-6"
      >
        {questions.map((q) => (
          <fieldset key={q.id} className="border border-line-strong bg-bg-raised">
            <legend className="sr-only">{q.prompt}</legend>
            <p
              aria-hidden="true"
              className="border-b border-line px-4 py-3 font-display text-md text-ink-strong"
            >
              {q.prompt}
            </p>
            <div className="flex flex-wrap gap-2 p-4">
              {q.options.map((o, i) => (
                <label
                  key={o.label}
                  className="hud-label inline-flex min-h-10 cursor-pointer items-center border border-line-strong px-4 py-2 text-ink hover:bg-bg-sunken has-[:checked]:border-invert-bg has-[:checked]:bg-invert-bg has-[:checked]:text-invert-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === i}
                    onChange={() => answer(q.id, i)}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => {
            setAnswers({});
            setNewest(undefined);
          }}
          disabled={answered === 0}
          className="hud-label h-11 px-1 text-accent-ink underline underline-offset-4 disabled:opacity-40"
        >
          Start over
        </button>
      </form>

      <div className="lg:sticky lg:top-16 lg:self-start" aria-live="polite">
        <Receipt items={items} date="live" newest={newest} />
      </div>
    </div>
  );
}
