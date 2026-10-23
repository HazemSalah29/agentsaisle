import type { ComponentPropsWithoutRef } from "react";

type GridProps = ComponentPropsWithoutRef<"div"> & {
  /** Columns from tablet up. A phone always gets one. */
  cols?: 2 | 3 | 4;
};

const colClass = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
} as const;

/** An even grid with the standard gap. */
export function Grid({ cols = 3, className = "", ...rest }: GridProps) {
  return <div className={`grid gap-6 ${colClass[cols]} ${className}`.trim()} {...rest} />;
}
