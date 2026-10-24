import { Container } from "./Container";
import { FadeUp } from "./FadeUp";
import { Section } from "./Section";

export interface Logo {
  name: string;
  /** Optional image. Without it the name is set as a plain wordmark. Shown in grey, never in color. */
  src?: string;
  width?: number;
  height?: number;
}

export interface LogoCloudProps {
  title?: string;
  logos: readonly Logo[];
}

/** A quiet row of partner or customer names. Always monochrome. */
export function LogoCloud({ title, logos }: LogoCloudProps) {
  return (
    <Section className="py-12 md:py-16">
      <Container>
        <FadeUp>
          {title ? <p className="text-center text-caption text-muted">{title}</p> : null}
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {logos.map((logo) => (
              <li key={logo.name}>
                {logo.src ? (
                  <img
                    src={logo.src}
                    alt={logo.name}
                    width={logo.width ?? 120}
                    height={logo.height ?? 32}
                    loading="lazy"
                    className="h-8 w-auto opacity-60 grayscale"
                  />
                ) : (
                  <span className="text-h4 font-semibold tracking-tight text-muted">
                    {logo.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </FadeUp>
      </Container>
    </Section>
  );
}
