/**
 * Motion tokens for the kit, in the units the `motion` library uses (seconds, cubic-bezier
 * arrays). They mirror the CSS variables in tokens.css; a test keeps the two in step.
 * Kit components take every duration, easing and stagger from here, never a literal.
 */
export const duration = { fast: 0.2, base: 0.45, slow: 0.9, epic: 1.4 } as const;

export const ease = {
  outExpo: [0.16, 1, 0.3, 1],
  inOutQuart: [0.76, 0, 0.24, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Delay between siblings, in seconds. */
export const stagger = { word: 0.04, item: 0.08 } as const;

export type DurationName = keyof typeof duration;
