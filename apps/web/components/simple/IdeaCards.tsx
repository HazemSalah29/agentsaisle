"use client";

import { m } from "framer-motion";
import { useCopy } from "../CopyButton";
import { EASE } from "./motion";

export type Idea = { title: string; text: string; say: string };

function SayBox({ say }: { say: string }) {
  const { state, copy } = useCopy(say);
  return (
    <div className="mt-auto border border-line bg-bg-sunken p-3">
      <p className="hud-label text-muted">Try saying</p>
      <p className="mt-1.5 text-sm text-ink">&ldquo;{say}&rdquo;</p>
      <button
        type="button"
        onClick={copy}
        className="hud-label mt-2.5 text-accent-ink underline underline-offset-4"
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Select the text" : "Copy this"}
      </button>
    </div>
  );
}

const grid = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
const card = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
const bar = {
  rest: { scaleX: 0 },
  hover: { scaleX: 1, transition: { duration: 0.35, ease: EASE } },
};

/** The things you can ask for, as cards that rise in one after another and lift when hovered. */
export function IdeaCards({ ideas }: { ideas: Idea[] }) {
  return (
    <m.ul
      className="grid gap-4 sm:grid-cols-2"
      variants={grid}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
    >
      {ideas.map((idea, i) => (
        <m.li key={idea.title} variants={card} className="flex">
          <m.div
            className="relative flex w-full flex-col gap-3 overflow-hidden border border-line-strong bg-bg-raised p-5 hover:border-accent"
            initial="rest"
            whileHover="hover"
            animate="rest"
          >
            <m.span
              aria-hidden="true"
              variants={bar}
              className="absolute inset-x-0 top-0 h-[3px] origin-left bg-accent"
            />
            <m.span
              className="block"
              variants={{ rest: { y: 0 }, hover: { y: -3 } }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <span className="hud-label text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 text-lg">{idea.title}</h3>
              <p className="mt-2 text-sm text-muted">{idea.text}</p>
            </m.span>
            <SayBox say={idea.say} />
          </m.div>
        </m.li>
      ))}
    </m.ul>
  );
}
