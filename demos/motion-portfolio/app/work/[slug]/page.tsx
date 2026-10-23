import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactCTA, Container, RevealText, Section } from "../../../src/components/kit";
import { PROJECTS } from "../../../src/content";

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = PROJECTS.find((p) => p.slug === slug);
  return { title: project ? `${project.title}, Lowtide Studio` : "Not found" };
}

export default async function Project({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const index = PROJECTS.findIndex((p) => p.slug === slug);
  const project = PROJECTS[index];
  if (!project) notFound();
  const next = PROJECTS[(index + 1) % PROJECTS.length]!;

  return (
    <main>
      <Section pad="hero">
        <Container className="pt-20">
          <RevealText
            as="h1"
            immediate
            text={project.title}
            className="font-display text-display text-ink uppercase"
          />
          <dl className="mt-10 grid gap-6 border-t border-line pt-6 md:grid-cols-4">
            <div>
              <dt className="text-sm text-muted">Client</dt>
              <dd className="text-ink">{project.client}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Year</dt>
              <dd className="text-ink">{project.year}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Type</dt>
              <dd className="text-ink">{project.category}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Role</dt>
              <dd className="text-ink">{project.role}</dd>
            </div>
          </dl>
        </Container>
      </Section>
      <Section className="pt-0">
        <Container>
          <img
            src={project.image.src}
            width={project.image.width}
            height={project.image.height}
            alt={project.image.alt}
            className="block h-auto w-full"
          />
        </Container>
      </Section>
      <Section className="pt-0">
        <Container className="grid gap-10 md:grid-cols-12">
          <p className="text-lead text-ink md:col-span-5">{project.summary}</p>
          <div className="flex flex-col gap-6 md:col-span-6 md:col-start-7">
            {project.body.map((paragraph) => (
              <p key={paragraph} className="text-lead text-muted">
                {paragraph}
              </p>
            ))}
          </div>
        </Container>
      </Section>
      <Section className="border-t border-line">
        <Container>
          <ContactCTA label={`Next: ${next.title}`} href={next.href} />
        </Container>
      </Section>
    </main>
  );
}
