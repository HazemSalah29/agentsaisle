import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "./Container";
import { FadeUp } from "./FadeUp";
import { Section } from "./Section";

export interface FeatureSplitProps {
  title: string;
  description: string;
  /** Short supporting points, each with a check mark. */
  points?: readonly string[];
  link?: { label: string; href: string };
  /** The image or mock-up. Give it real width and height. */
  media: ReactNode;
  /** Put the media on the left. Alternate this down a page. */
  reverse?: boolean;
  tone?: "default" | "subtle";
}

/** Text beside an image. Stacks on a phone, text first. */
export function FeatureSplit({
  title,
  description,
  points,
  link,
  media,
  reverse = false,
  tone = "default",
}: FeatureSplitProps) {
  return (
    <Section tone={tone}>
      <Container className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
        <FadeUp className={reverse ? "md:order-2" : undefined}>
          <h2 className="text-h2 font-semibold text-ink">{title}</h2>
          <p className="mt-4 text-lead text-muted">{description}</p>
          {points && points.length > 0 ? (
            <ul className="mt-6 space-y-3">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-body text-ink">
                  <Check size={18} className="mt-1 shrink-0 text-brand-700" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          ) : null}
          {link ? (
            <a
              href={link.href}
              className="mt-8 inline-block text-body font-medium text-ink underline decoration-border underline-offset-4 transition-colors duration-(--duration-hover) hover:decoration-ink"
            >
              {link.label}
            </a>
          ) : null}
        </FadeUp>
        <FadeUp delay={100}>
          <div className="overflow-hidden rounded-2xl border border-border bg-subtle">{media}</div>
        </FadeUp>
      </Container>
    </Section>
  );
}
