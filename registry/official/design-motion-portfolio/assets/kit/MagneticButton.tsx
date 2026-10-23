"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import type { PointerEvent, ReactNode } from "react";
import { useMotionOk } from "./use-motion-ok";

export interface MagneticButtonProps {
  children: ReactNode;
  /** Renders a link when given, a button otherwise. */
  href?: string;
  onClick?: () => void;
  /** How far the button follows the pointer, from 0 (not at all) to 1 (fully). Default 0.3. */
  strength?: number;
  /** "solid" fills with the accent color; "outline" is a hairline ring. */
  variant?: "solid" | "outline";
  className?: string;
}

const base =
  "inline-flex items-center justify-center rounded-full px-6 py-3 font-body text-base font-medium tracking-tight";
const variants = {
  solid: "bg-accent text-on-accent",
  outline: "border border-ink text-ink",
} as const;

/** A call to action that drifts toward the pointer. Plain, still button for touch and reduced motion. */
export function MagneticButton({
  children,
  href,
  onClick,
  strength = 0.3,
  variant = "solid",
  className = "",
}: MagneticButtonProps) {
  const motionOk = useMotionOk();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });
  const cls = `${base} ${variants[variant]} ${className}`.trim();

  function move(e: PointerEvent<HTMLElement>) {
    if (!motionOk || e.pointerType !== "mouse") return;
    const box = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (box.left + box.width / 2)) * strength);
    y.set((e.clientY - (box.top + box.height / 2)) * strength);
  }
  function leave() {
    x.set(0);
    y.set(0);
  }

  const shared = { onPointerMove: move, onPointerLeave: leave, style: { x: sx, y: sy } };
  return href ? (
    <motion.a href={href} className={cls} {...shared}>
      {children}
    </motion.a>
  ) : (
    <motion.button type="button" onClick={onClick} className={cls} {...shared}>
      {children}
    </motion.button>
  );
}
