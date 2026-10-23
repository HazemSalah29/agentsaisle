/** Deterministic visuals for a skill: no screenshots exist, so each skill gets a generated plate. */

function hash(input: string): number {
  // FNV-1a, 32 bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const PLATE_COLS = 12;
export const PLATE_ROWS = 6;

/** A left-right symmetric grid of intensity levels (0 to 3), the same for the same name. */
export function plateCells(name: string): number[][] {
  let seed = hash(name) || 1;
  const next = () => {
    // xorshift32
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed;
  };
  return Array.from({ length: PLATE_ROWS }, () => {
    const half = Array.from({ length: PLATE_COLS / 2 }, () =>
      next() % 100 < 45 ? 1 + (next() % 3) : 0,
    );
    return [...half, ...[...half].reverse()];
  });
}

const AISLES = ["code", "design", "git", "writing", "video"] as const;

/** CSS color for a skill's first known aisle; falls back to the base accent. */
export function aisleColor(categories: string[]): string {
  const hit = categories.find((c): c is (typeof AISLES)[number] =>
    (AISLES as readonly string[]).includes(c),
  );
  return hit ? `var(--aisle-${hit})` : "var(--accent-ink)";
}
