"use client";

import { m, useInView } from "motion/react";
import { useRef, type ElementType } from "react";
import { duration, ease, stagger } from "./tokens";
import { useMotionOk } from "./use-motion-ok";

/** One line of a multi-line reveal, with optional classes for that line only. */
export type RevealLine = string | { text: string; className?: string };

export interface RevealTextProps {
  /** A string reveals word by word. An array reveals line by line, one entry per line. */
  text: string | readonly RevealLine[];
  /** The element to render. Use "h1" for the page title. */
  as?: ElementType;
  className?: string;
  /** Seconds to wait before the first word moves. Use a token-sized value. */
  delay?: number;
  /** Reveal as soon as the page loads instead of waiting to scroll into view. */
  immediate?: boolean;
}

/** Words or lines rise out of a mask. Only transform animates. */
export function RevealText({
  text,
  as: Tag = "p",
  className = "",
  delay = 0,
  immediate = false,
}: RevealTextProps) {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const motionOk = useMotionOk();
  const lines =
    typeof text === "string" ? null : text.map((l) => (typeof l === "string" ? { text: l } : l));
  const units = lines ? lines.map((l) => l.text) : (text as string).split(/\s+/).filter(Boolean);
  const step = lines ? stagger.item : stagger.word;
  const label = units.join(" ");
  const show = immediate || seen;

  return (
    <Tag ref={ref} className={className}>
      <span className="sr-only">{label}</span>
      {units.map((unit, i) => (
        <span
          key={`${i}-${unit}`}
          aria-hidden="true"
          className={
            lines
              ? `block overflow-hidden pb-[0.12em] -mb-[0.12em] ${lines[i]?.className ?? ""}`.trim()
              : "inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]"
          }
        >
          <m.span
            data-kit-motion
            className="inline-block will-change-transform"
            initial={motionOk ? { y: "110%" } : false}
            animate={show ? { y: "0%" } : undefined}
            transition={{ duration: duration.slow, ease: ease.outExpo, delay: delay + i * step }}
          >
            {unit}
            {typeof text === "string" && i < units.length - 1 ? " " : ""}
          </m.span>
        </span>
      ))}
    </Tag>
  );
}
