import type { Metadata } from "next";
import { Container, Grid, ProjectCard, RevealText, Section } from "../../src/components/kit";
import { PROJECTS } from "../../src/content";

export const metadata: Metadata = { title: "Work, Lowtide Studio" };

export default function Work() {
  return (
    <main>
      <Section pad="hero">
        <Container className="pt-20">
          <RevealText
            as="h1"
            immediate
            text={["Selected", "work."]}
            className="font-display text-display text-ink uppercase"
          />
        </Container>
      </Section>
      <Section className="pt-0">
        <Container>
          <Grid cols={2} className="gap-x-8 gap-y-16">
            {PROJECTS.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </Grid>
        </Container>
      </Section>
    </main>
  );
}
