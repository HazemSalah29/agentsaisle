import type { ComponentPropsWithoutRef } from "react";

type SectionProps = ComponentPropsWithoutRef<"section"> & {
  /** "subtle" sits on the light grey ground to separate it from its neighbors. */
  tone?: "default" | "subtle";
};

const tones = { default: "bg-ground", subtle: "bg-subtle" } as const;

/** A full-width band with generous vertical space. Put a `Container` inside it. */
export function Section({ tone = "default", className = "", ...rest }: SectionProps) {
  return <section className={`${tones[tone]} py-20 md:py-28 ${className}`.trim()} {...rest} />;
}
