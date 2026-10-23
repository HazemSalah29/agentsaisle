import {
  BlogGrid,
  ContactCTA,
  Container,
  HeroKinetic,
  MagneticButton,
  Marquee,
  RevealText,
  Section,
  ServiceList,
  StatCounter,
  WorkGallery,
} from "../src/components/kit";
import { CLIENT_WORDS, POSTS, PROJECTS, SERVICES, STATS } from "../src/content";

export default function Home() {
  return (
    <main>
      <Section pad="hero" className="min-h-svh">
        <Container>
          <HeroKinetic
            lines={[
              { text: "Interfaces,", width: "normal" },
              { text: "choreographed", width: "narrow" },
              { text: "frame by frame.", width: "wide" },
            ]}
            intro="Lowtide is a two-person motion and web studio. We design the in-between: the half second where a page decides whether to be trusted."
            actions={
              <>
                <MagneticButton href="/work">See the work</MagneticButton>
                <MagneticButton href="/contact" variant="outline">
                  Say hello
                </MagneticButton>
              </>
            }
            media={
              <img
                src="/art/plate-tide.svg"
                width={1200}
                height={900}
                alt="Abstract plate: concentric violet arcs rising from a dark horizon."
                className="block h-auto w-full"
              />
            }
          />
        </Container>
      </Section>

      <Section className="border-y border-line py-10">
        <Marquee speed="slow">
          {CLIENT_WORDS.map((c) => (
            <span key={c} className="px-8 font-display text-title text-muted uppercase">
              {c}
            </span>
          ))}
        </Marquee>
      </Section>

      <Section>
        <Container className="grid gap-10 md:grid-cols-12">
          <RevealText
            as="h2"
            text="Most sites move because they can. Ours move because something just changed."
            className="font-display text-title text-ink uppercase md:col-span-8"
          />
          <p className="text-lead text-muted md:col-span-4 md:col-start-9">
            We keep the system small: four durations, two curves, and a rule that only transform and
            opacity ever animate. That is why the sites stay fast.
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

      <Section className="pb-0">
        <Container>
          <RevealText
            as="h2"
            text="Selected work"
            className="font-display text-title text-ink uppercase"
          />
        </Container>
      </Section>
      <WorkGallery projects={PROJECTS} />

      <Section>
        <Container>
          <RevealText
            as="h2"
            text="What we make"
            className="mb-12 font-display text-title text-ink uppercase"
          />
          <ServiceList services={SERVICES} />
        </Container>
      </Section>

      <Section>
        <Container>
          <RevealText
            as="h2"
            text="From the journal"
            className="mb-12 font-display text-title text-ink uppercase"
          />
          <BlogGrid posts={POSTS} />
        </Container>
      </Section>

      <Section className="border-t border-line">
        <Container>
          <ContactCTA label="Let's talk" href="/contact" note="We reply within two working days." />
        </Container>
      </Section>
    </main>
  );
}
