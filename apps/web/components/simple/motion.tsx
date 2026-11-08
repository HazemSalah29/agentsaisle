"use client";

import { LazyMotion, MotionConfig, m } from "framer-motion";
import type { ReactNode } from "react";

/** The animation features load after the page is shown, so they never delay the first paint. */
const loadFeatures = () => import("./features").then((mod) => mod.default);

/** One place that sets up Framer Motion for a page: lazy features, and reduced motion honoured. */
export function SimpleMotion({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/** The easing used everywhere on these pages: quick start, soft landing. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts its content into view the first time it scrolls on screen. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </m.div>
  );
}

/** The easing for list items: they rise one after another. */
export const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
