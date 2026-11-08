"use client";

import { m } from "framer-motion";
import type { ReactNode } from "react";
import { EASE } from "./motion";

const line = {
  hidden: { y: "105%" },
  show: (i: number) => ({
    y: "0%",
    transition: { duration: 0.8, delay: 0.1 + i * 0.12, ease: EASE },
  }),
};

/** The top of a page: a small label, a plain headline that rises into place, one sentence, and the actions. */
export function PageIntro({
  eyebrow,
  lines,
  accent = "",
  intro,
  actions,
  aside,
  size = "xl",
}: {
  eyebrow: ReactNode;
  lines: string[];
  accent?: string;
  intro?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  size?: "xl" | "lg";
}) {
  return (
    <header
      className={`grid items-center gap-x-12 gap-y-10 px-4 sm:px-8 ${
        size === "xl" ? "py-14 sm:py-20" : "py-12 sm:py-14"
      } ${aside ? "lg:grid-cols-[1fr_17rem]" : ""}`}
    >
      <div className="min-w-0">
        <m.p
          className="hud-label text-accent-ink"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {eyebrow}
        </m.p>
        <h1 className={`mt-5 ${size === "xl" ? "text-4xl" : "text-3xl"}`}>
          {lines.map((text, i) => (
            <span key={text} className="block overflow-hidden pb-[0.12em]">
              <m.span className="block" variants={line} custom={i} initial="hidden" animate="show">
                {text}
              </m.span>
            </span>
          ))}
          {accent && (
            <span className="block overflow-hidden pb-[0.12em]">
              <m.span
                className="block font-serif font-normal text-accent-ink italic"
                variants={line}
                custom={lines.length}
                initial="hidden"
                animate="show"
              >
                {accent}
              </m.span>
            </span>
          )}
        </h1>
        {intro && (
          <m.div
            className="mt-6 max-w-xl text-md text-muted"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
          >
            {intro}
          </m.div>
        )}
        {actions && (
          <m.div
            className="mt-7 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: EASE }}
          >
            {actions}
          </m.div>
        )}
      </div>
      {aside && (
        <m.div
          initial={{ opacity: 0, y: 28, rotate: 1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
        >
          {aside}
        </m.div>
      )}
    </header>
  );
}

/** The one main action of a page. */
export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <m.a
      href={href}
      className="hud-label inline-flex h-11 items-center gap-3 bg-accent px-6 font-bold text-on-accent"
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.97 }}
    >
      {children}
      <span aria-hidden="true">→</span>
    </m.a>
  );
}

/** A quieter second action. */
export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <m.a
      href={href}
      className="hud-label inline-flex h-11 items-center border border-line-strong px-6 text-ink hover:bg-invert-bg hover:text-invert-fg"
      whileTap={{ scale: 0.97 }}
    >
      {children}
    </m.a>
  );
}
