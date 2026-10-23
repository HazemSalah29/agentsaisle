import type { Metadata } from "next";
import {
  Container,
  ContactCTA,
  RevealText,
  Section,
  ServiceList,
  StatCounter,
} from "../../src/components/kit";
import { SERVICES, STATS } from "../../src/content";

export const metadata: Metadata = { title: "About, Lowtide Studio" };

export default function About() {
  return (
    <main>
      <Section pad="hero">
        <Container className="pt-20">
          <RevealText
            as="h1"
            immediate
            text={["Two people,", "one small system."]}
            className="font-display text-display text-ink uppercase"
          />
        </Container>
      </Section>
      <Section className="pt-0">
        <Container className="grid gap-10 md:grid-cols-12">
          <RevealText
            text="Lowtide began as a motion-design side project and became a studio once the side project had more clients than the day job. We still work in a pair, so the person you brief is the person who builds."
            className="text-lead text-ink md:col-span-7"
          />
          <p className="text-lead text-muted md:col-span-4 md:col-start-9">
            [PLACEHOLDER] Add your own story here: where you started, what you care about, and who
            you want to work with.
          </p>
        </Container>
      </Section>
      <Section className="pt-0">
        <Container className="grid gap-10 md:grid-cols-4">
          {STATS.map((s) => (
            <StatCounter key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
          ))}
        </Container>
      </Section>
      <Section className="pt-0">
        <Container>
          <ServiceList services={SERVICES} />
        </Container>
      </Section>
      <Section className="border-t border-line">
        <Container>
          <ContactCTA label="Work with us" href="/contact" />
        </Container>
      </Section>
    </main>
  );
}
