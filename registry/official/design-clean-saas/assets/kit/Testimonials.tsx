import { Star } from "lucide-react";
import { Container } from "./Container";
import { FadeUp } from "./FadeUp";
import { Grid } from "./Grid";
import { Section } from "./Section";

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  /** Photo URL. Without it, initials are shown. */
  avatar?: string;
  /** 1 to 5. Leave out to show no stars. */
  rating?: number;
}

export interface TestimonialsProps {
  title: string;
  items: readonly Testimonial[];
  tone?: "default" | "subtle";
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Quote cards. Use real quotes with permission, or `[PLACEHOLDER]`; never invent customers. */
export function Testimonials({ title, items, tone = "default" }: TestimonialsProps) {
  return (
    <Section tone={tone}>
      <Container>
        <FadeUp className="max-w-2xl">
          <h2 className="text-h2 font-semibold text-ink">{title}</h2>
        </FadeUp>
        <Grid cols={3} className="mt-12">
          {items.map((t, i) => (
            <FadeUp key={t.name} delay={(i % 3) * 50}>
              <figure className="flex h-full flex-col rounded-2xl border border-border bg-ground p-6">
                {t.rating ? (
                  <div
                    className="mb-4 flex gap-0.5 text-ink"
                    role="img"
                    aria-label={`${t.rating} out of 5 stars`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={16}
                        strokeWidth={0}
                        fill={n <= t.rating! ? "currentColor" : "var(--color-border)"}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                ) : null}
                <blockquote className="flex-1 text-body text-ink">{t.quote}</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  {t.avatar ? (
                    <img
                      src={t.avatar}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-subtle text-caption font-semibold text-muted"
                    >
                      {initials(t.name)}
                    </span>
                  )}
                  <span>
                    <span className="block text-body font-medium text-ink">{t.name}</span>
                    <span className="block text-caption text-muted">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            </FadeUp>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
