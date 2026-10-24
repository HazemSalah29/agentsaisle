import { Star } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "./Container";
import { FadeUp } from "./FadeUp";
import { Section } from "./Section";

export interface HeroLink {
  label: string;
  href: string;
}

export interface HeroRating {
  /** Such as "4.8". */
  score: string;
  /** Such as "from 1,200 reviews". */
  label: string;
}

export interface HeroProps {
  /** A short announcement above the headline, in sentence case. Leave out if there is nothing new. */
  eyebrow?: string;
  headline: string;
  subtext: string;
  primaryCta: HeroLink;
  secondaryCta?: HeroLink;
  ratings?: readonly HeroRating[];
  /** The product image or mock-up. Give it real width and height. */
  media?: ReactNode;
}

/** The first screen: headline, one sentence, two actions, proof, and the product. */
export function Hero({
  eyebrow,
  headline,
  subtext,
  primaryCta,
  secondaryCta,
  ratings,
  media,
}: HeroProps) {
  return (
    <Section className="overflow-hidden pt-16 pb-0 md:pt-24 md:pb-0">
      <Container>
        <div className="max-w-3xl">
          {eyebrow ? (
            <FadeUp immediate>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-subtle px-3 py-1 text-caption text-muted">
                {eyebrow}
              </p>
            </FadeUp>
          ) : null}
          <FadeUp immediate delay={50}>
            <h1 className="text-h1 font-semibold text-ink">{headline}</h1>
          </FadeUp>
          <FadeUp immediate delay={100}>
            <p className="mt-6 max-w-xl text-lead text-muted">{subtext}</p>
          </FadeUp>
          <FadeUp immediate delay={150}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={primaryCta.href}
                className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-6 py-3 text-body font-medium text-ground transition-colors duration-(--duration-hover) hover:bg-brand-800"
              >
                {primaryCta.label}
              </a>
              {secondaryCta ? (
                <a
                  href={secondaryCta.href}
                  className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-body font-medium text-ink transition-colors duration-(--duration-hover) hover:bg-subtle"
                >
                  {secondaryCta.label}
                </a>
              ) : null}
            </div>
          </FadeUp>
          {ratings && ratings.length > 0 ? (
            <FadeUp immediate delay={200}>
              <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
                {ratings.map((r) => (
                  <li key={r.label} className="flex items-center gap-2 text-caption text-muted">
                    <span className="flex gap-0.5 text-ink" aria-hidden="true">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
                      ))}
                    </span>
                    <span>
                      <strong className="font-semibold text-ink">{r.score}</strong> {r.label}
                    </span>
                  </li>
                ))}
              </ul>
            </FadeUp>
          ) : null}
        </div>
        {media ? (
          <FadeUp immediate delay={250}>
            <div className="mt-14 overflow-hidden rounded-t-2xl border border-b-0 border-border bg-subtle shadow-soft md:mt-20">
              {media}
            </div>
          </FadeUp>
        ) : null}
      </Container>
    </Section>
  );
}
