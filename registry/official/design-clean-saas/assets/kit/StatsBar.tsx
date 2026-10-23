import { Container } from "./Container";
import { FadeUp } from "./FadeUp";
import { Section } from "./Section";

export interface Stat {
  value: string;
  label: string;
}

export interface StatsBarProps {
  /** 3 or 4 figures. Use real numbers or leave `[PLACEHOLDER]`. */
  stats: readonly Stat[];
  tone?: "default" | "subtle";
}

/** A row of big figures with small labels. */
export function StatsBar({ stats, tone = "default" }: StatsBarProps) {
  return (
    <Section tone={tone} className="py-12 md:py-16">
      <Container>
        <FadeUp>
          <dl className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:divide-x md:divide-border">
            {stats.map((s) => (
              <div key={s.label} className="md:px-8 md:first:pl-0">
                <dd className="text-h3 font-semibold tracking-tight text-ink">{s.value}</dd>
                <dt className="mt-1 text-caption text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        </FadeUp>
      </Container>
    </Section>
  );
}
