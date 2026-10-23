import type { Metadata } from "next";
import { ContactCTA, Container, RevealText, Section } from "../../src/components/kit";

export const metadata: Metadata = { title: "Contact, Lowtide Studio" };

export default function Contact() {
  return (
    <main>
      <Section pad="hero" className="min-h-svh">
        <Container className="pt-20">
          <RevealText
            as="h1"
            immediate
            text={["Have a", "project?"]}
            className="mb-16 font-display text-display text-ink uppercase"
          />
          <ContactCTA
            label="hello@lowtide.example"
            href="mailto:hello@lowtide.example"
            note="[PLACEHOLDER] Replace with a real address. We reply within two working days."
          />
        </Container>
      </Section>
    </main>
  );
}
