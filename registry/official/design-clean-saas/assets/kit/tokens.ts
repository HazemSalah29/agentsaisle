/**
 * Motion tokens for the kit, in seconds. They mirror the CSS variables in tokens.css; a test keeps
 * the two in step. The kit has exactly two timings: a 300 ms fade-up on enter and 150 ms hovers.
 */
export const duration = { enter: 0.3, hover: 0.15 } as const;

export const ease = { standard: [0.2, 0, 0, 1] } as const satisfies Record<
  string,
  readonly [number, number, number, number]
>;
