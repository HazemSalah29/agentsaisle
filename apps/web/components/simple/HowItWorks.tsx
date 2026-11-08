"use client";

import { m } from "framer-motion";
import { EASE } from "./motion";

export type Step = { title: string; text: string };

/** Three steps in a row. A line draws itself across them as they scroll into view. */
export function HowItWorks({ steps, cols = 3 }: { steps: Step[]; cols?: 3 | 4 }) {
  return (
    <m.ol
      className={`relative grid gap-8 ${cols === 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.25 } } }}
    >
      <m.span
        aria-hidden="true"
        className={`absolute top-6 left-6 hidden h-px origin-left bg-line-strong ${cols === 4 ? "right-[10%] xl:block" : "right-[16%] md:block"}`}
        variants={{
          hidden: { scaleX: 0 },
          show: { scaleX: 1, transition: { duration: 1.1, ease: EASE } },
        }}
      />
      {steps.map((step, i) => (
        <m.li
          key={step.title}
          className="relative"
          variants={{
            hidden: { opacity: 0, y: 24 },
            show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
          }}
        >
          <m.span
            className="hud-label relative flex h-12 w-12 items-center justify-center border border-line-strong bg-bg font-bold text-ink"
            variants={{
              hidden: { backgroundColor: "var(--bg)", color: "var(--ink)" },
              show: {
                backgroundColor: "var(--accent)",
                color: "var(--on-accent)",
                transition: { duration: 0.4, delay: 0.1 },
              },
            }}
          >
            {i + 1}
          </m.span>
          <h3 className="mt-4 text-lg">{step.title}</h3>
          <p className="mt-2 max-w-xs text-sm text-muted">{step.text}</p>
        </m.li>
      ))}
    </m.ol>
  );
}
