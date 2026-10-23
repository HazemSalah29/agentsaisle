import type { ReactNode } from "react";
import { Container } from "./Container";
import { FadeUp } from "./FadeUp";
import { Grid } from "./Grid";
import { Section } from "./Section";

export interface Feature {
  /** A `lucide-react` icon element, such as `<Clock size={20} />`. Icons come from that set only. */
  icon: ReactNode;
  title: string;
  description: string;
}

export interface FeatureGridProps {
  title: string;
  intro?: string;
  /** 3 or 6 features. */
  features: readonly Feature[];
  tone?: "default" | "subtle";
}

/** A heading and a grid of icon cards. The only brand color here is the icons. */
export function FeatureGrid({ title, intro, features, tone = "default" }: FeatureGridProps) {
  return (
    <Section tone={tone}>
      <Container>
        <FadeUp className="max-w-2xl">
          <h2 className="text-h2 font-semibold text-ink">{title}</h2>
          {intro ? <p className="mt-4 text-lead text-muted">{intro}</p> : null}
        </FadeUp>
        <Grid cols={3} className="mt-12">
          {features.map((f, i) => (
            <FadeUp key={f.title} delay={(i % 3) * 50}>
              <article className="h-full rounded-2xl border border-border bg-ground p-6">
                <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-subtle text-brand-700">
                  {f.icon}
                </div>
                <h3 className="text-lead font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-body text-muted">{f.description}</p>
              </article>
            </FadeUp>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
