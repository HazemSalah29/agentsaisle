"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { duration, ease } from "./tokens";
import { useMotionOk } from "./use-motion-ok";

export interface StatCounterProps {
  value: number;
  label: string;
  /** Text after the number, such as "+" or "%". */
  suffix?: string;
  className?: string;
}

/** A number that counts up once when it scrolls into view. Shows the final number from the start for no-JS and reduced motion. */
export function StatCounter({ value, label, suffix = "", className = "" }: StatCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const motionOk = useMotionOk();
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!seen || !motionOk) return;
    const controls = animate(0, value, {
      duration: duration.epic,
      ease: ease.outExpo,
      onUpdate: (n) => setShown(Math.round(n)),
    });
    return () => controls.stop();
  }, [seen, motionOk, value]);

  return (
    <div ref={ref} className={className}>
      <p className="font-display text-title text-ink tabular-nums">
        <span aria-hidden="true">{shown}</span>
        <span className="sr-only">{value}</span>
        {suffix}
      </p>
      <p className="mt-2 text-muted">{label}</p>
    </div>
  );
}
