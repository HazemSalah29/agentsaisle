"use client";

import { m } from "framer-motion";
import type { ReactNode } from "react";
import { EASE, itemVariants } from "./motion";

const grid = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const bar = {
  rest: { scaleX: 0 },
  hover: { scaleX: 1, transition: { duration: 0.35, ease: EASE } },
};

/** A list of separate cards that rise in one after another the first time they scroll into view. */
export function CardGrid({
  children,
  className = "sm:grid-cols-2 xl:grid-cols-3",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <m.ul
      aria-label={label}
      className={`grid gap-4 ${className}`}
      variants={grid}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </m.ul>
  );
}

/** One card: a hairline box that lifts and grows an orange top bar when pointed at. */
export function CardItem({ children, plain = false }: { children: ReactNode; plain?: boolean }) {
  return (
    <m.li variants={itemVariants} className="flex">
      <m.div
        className={`relative flex w-full flex-col overflow-hidden border bg-bg-raised ${
          plain ? "border-line-strong" : "border-line-strong hover:border-accent"
        }`}
        initial="rest"
        animate="rest"
        whileHover={plain ? undefined : { y: -4 }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        {!plain && (
          <m.span
            aria-hidden="true"
            variants={bar}
            className="absolute inset-x-0 top-0 z-10 h-[3px] origin-left bg-accent"
          />
        )}
        {children}
      </m.div>
    </m.li>
  );
}
