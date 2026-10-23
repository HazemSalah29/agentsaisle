"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { RevealText, type RevealLine } from "./RevealText";
import { duration, ease } from "./tokens";
import { useMotionOk } from "./use-motion-ok";

/** A headline line and how wide its letters are drawn. Wide shows from tablet up; a phone is always narrow. */
export interface HeroLine {
  text: string;
  width?: "narrow" | "normal" | "wide";
}

const widths = {
  narrow: "stretch-narrow",
  normal: "stretch-narrow md:stretch-normal",
  wide: "stretch-narrow md:stretch-wide",
} as const;

export interface HeroKineticProps {
  /** The headline, one entry per line. Each line rises out of its own mask. */
  lines: readonly (string | HeroLine)[];
  /** Short supporting paragraph under the headline. */
  intro: ReactNode;
  /** Buttons or links, usually `MagneticButton`s. */
  actions?: ReactNode;
  /** An image or any visual. It is uncovered by a wipe when the page loads. */
  media?: ReactNode;
}

/** Oversized headline plus a media plate. The first thing a visitor sees, so it reveals on load. */
export function HeroKinetic({ lines, intro, actions, media }: HeroKineticProps) {
  const motionOk = useMotionOk();
  const revealLines: RevealLine[] = lines.map((l) =>
    typeof l === "string" ? l : { text: l.text, className: widths[l.width ?? "normal"] },
  );

  return (
    <div className="flex flex-col gap-10 md:gap-15">
      <RevealText
        as="h1"
        text={revealLines}
        immediate
        className="font-display text-display text-ink uppercase"
      />
      <div className="grid items-end gap-8 md:grid-cols-12">
        <div className="flex flex-col gap-6 md:col-span-5">
          <p className="text-lead max-w-[34ch] text-muted">{intro}</p>
          {actions ? <div className="flex flex-wrap items-center gap-4">{actions}</div> : null}
        </div>
        {media ? (
          <div className="relative overflow-hidden md:col-span-6 md:col-start-7">
            <motion.div
              data-kit-motion
              initial={motionOk ? { scale: 1.25 } : false}
              animate={{ scale: 1 }}
              transition={{ duration: duration.epic, ease: ease.outExpo, delay: 0.5 }}
            >
              {media}
            </motion.div>
            {motionOk ? (
              <motion.div
                data-kit-curtain
                aria-hidden="true"
                className="absolute inset-0 bg-accent will-change-transform"
                initial={{ y: "0%" }}
                animate={{ y: "-101%" }}
                transition={{ duration: duration.slow, ease: ease.inOutQuart, delay: 0.5 }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
