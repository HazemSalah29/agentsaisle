import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "./Container";
import { FadeUp } from "./FadeUp";
import { Grid } from "./Grid";
import { Section } from "./Section";

export interface Service {
  /** A `lucide-react` icon element. */
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  linkLabel?: string;
}

export interface ServiceCardsProps {
  title: string;
  intro?: string;
  services: readonly Service[];
  tone?: "default" | "subtle";
}

/** A heading and cards that each link somewhere. Hover only changes the border. */
export function ServiceCards({ title, intro, services, tone = "default" }: ServiceCardsProps) {
  return (
    <Section tone={tone}>
      <Container>
        <FadeUp className="max-w-2xl">
          <h2 className="text-h2 font-semibold text-ink">{title}</h2>
          {intro ? <p className="mt-4 text-lead text-muted">{intro}</p> : null}
        </FadeUp>
        <Grid cols={3} className="mt-12">
          {services.map((s, i) => (
            <FadeUp key={s.title} delay={(i % 3) * 50}>
              <a
                href={s.href}
                className="group flex h-full flex-col rounded-2xl border border-border bg-ground p-6 transition-colors duration-(--duration-hover) hover:border-ink"
              >
                <div className="mb-5 text-ink">{s.icon}</div>
                <h3 className="text-lead font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 flex-1 text-body text-muted">{s.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-body font-medium text-ink">
                  {s.linkLabel ?? "Learn more"}
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="transition-transform duration-(--duration-hover) group-hover:translate-x-1"
                  />
                </span>
              </a>
            </FadeUp>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
