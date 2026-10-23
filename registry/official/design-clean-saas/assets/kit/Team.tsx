import { Container } from "./Container";
import { FadeUp } from "./FadeUp";
import { Grid } from "./Grid";
import { Section } from "./Section";

export interface Person {
  name: string;
  role: string;
  /** Photo URL, square. Without it, initials are shown. */
  photo?: string;
  bio?: string;
}

export interface TeamProps {
  title: string;
  intro?: string;
  people: readonly Person[];
  tone?: "default" | "subtle";
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Profile cards. */
export function Team({ title, intro, people, tone = "default" }: TeamProps) {
  return (
    <Section tone={tone}>
      <Container>
        <FadeUp className="max-w-2xl">
          <h2 className="text-h2 font-semibold text-ink">{title}</h2>
          {intro ? <p className="mt-4 text-lead text-muted">{intro}</p> : null}
        </FadeUp>
        <Grid cols={4} className="mt-12">
          {people.map((p, i) => (
            <FadeUp key={p.name} delay={(i % 4) * 50}>
              <article>
                {p.photo ? (
                  <img
                    src={p.photo}
                    alt={p.name}
                    width={400}
                    height={400}
                    loading="lazy"
                    className="aspect-square w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex aspect-square w-full items-center justify-center rounded-2xl bg-subtle text-h3 font-semibold text-muted"
                  >
                    {initials(p.name)}
                  </div>
                )}
                <h3 className="mt-4 text-lead font-semibold text-ink">{p.name}</h3>
                <p className="text-body text-muted">{p.role}</p>
                {p.bio ? <p className="mt-2 text-caption text-muted">{p.bio}</p> : null}
              </article>
            </FadeUp>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
