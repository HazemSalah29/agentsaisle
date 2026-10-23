import type { ComponentPropsWithoutRef } from "react";

type SectionProps = ComponentPropsWithoutRef<"section"> & {
  /** "hero" uses a short top pad so the headline starts high on the screen. */
  pad?: "default" | "hero";
};

const pads = { default: "py-section", hero: "pt-12 pb-8" } as const;

/** A full-width band with the standard vertical rhythm. Put a `Container` inside it. */
export function Section({ pad = "default", className = "", ...rest }: SectionProps) {
  return <section className={`relative ${pads[pad]} ${className}`.trim()} {...rest} />;
}
