"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";
import { duration, ease } from "./tokens";
import { useMotionOk } from "./use-motion-ok";

/**
 * Route transition. Put it in `app/template.tsx`: Next re-creates a template on every
 * navigation, so the page fades and lifts in each time.
 */
export function PageEnter({ children }: { children: ReactNode }) {
  const motionOk = useMotionOk();
  return (
    <m.div
      data-kit-motion
      initial={motionOk ? { opacity: 0, y: 24 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: ease.outExpo }}
    >
      {children}
    </m.div>
  );
}
