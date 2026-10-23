import { Container, HeroKinetic, MagneticButton, Section } from "../src/components/kit";

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
                <MagneticButton href="#work">See the work</MagneticButton>
                <MagneticButton href="#contact" variant="outline">
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
    </main>
  );
}
