"use client";

import { useReducedMotion } from "motion/react";

/**
 * True when it is fine to move things. False when the visitor asked for reduced motion.
 * Before the browser answers (server render, first paint) this returns true; the CSS rule in
 * tokens.css keeps content visible in that gap for visitors who asked for less motion.
 */
export function useMotionOk(): boolean {
  return useReducedMotion() !== true;
}
