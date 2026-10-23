import type { Metadata } from "next";
import { BlogGrid, Container, RevealText, Section } from "../../src/components/kit";
import { POSTS } from "../../src/content";

export const metadata: Metadata = { title: "Journal, Lowtide Studio" };

export default function Blog() {
  return (
    <main>
      <Section pad="hero">
        <Container className="pt-20">
          <RevealText
            as="h1"
            immediate
            text={["The", "journal."]}
            className="font-display text-display text-ink uppercase"
          />
        </Container>
      </Section>
      <Section className="pt-0">
        <Container>
          <BlogGrid posts={[...POSTS, ...POSTS].map((p, i) => ({ ...p, href: `/blog#${i}` }))} />
        </Container>
      </Section>
    </main>
  );
}
