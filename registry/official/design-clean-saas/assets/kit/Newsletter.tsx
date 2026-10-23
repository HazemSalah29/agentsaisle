"use client";

import { useActionState } from "react";
import { subscribeNewsletter } from "./actions";
import { initialFormState, type FormState } from "./validate";
import { Container } from "./Container";
import { FadeUp } from "./FadeUp";
import { Section } from "./Section";

export interface NewsletterProps {
  title: string;
  description?: string;
  /** A server action `(previousState, formData) => FormState`. Default: the stub in `actions.ts`. */
  action?: (prev: FormState, data: FormData) => Promise<FormState>;
  tone?: "default" | "subtle";
}

/** One-line email signup. */
export function Newsletter({
  title,
  description,
  action = subscribeNewsletter,
  tone = "subtle",
}: NewsletterProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const error = state.errors.email;

  return (
    <Section tone={tone} className="py-16 md:py-20">
      <Container>
        <FadeUp className="mx-auto max-w-xl text-center">
          <h2 className="text-h3 font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-3 text-body text-muted">{description}</p> : null}
          <form action={formAction} noValidate className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="nl-email" className="sr-only">
              Email address
            </label>
            <input
              id="nl-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby="nl-status"
              className={`w-full flex-1 rounded-lg border bg-ground px-4 py-3 text-body text-ink placeholder:text-muted ${
                error ? "border-warning" : "border-border"
              }`}
            />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-6 py-3 text-body font-medium text-ground transition-colors duration-(--duration-hover) hover:bg-brand-800 disabled:opacity-60"
            >
              {pending ? "Subscribing" : "Subscribe"}
            </button>
          </form>
          <p
            id="nl-status"
            role="status"
            className={`mt-3 min-h-6 text-caption ${state.status === "success" ? "text-success" : "text-warning"}`}
          >
            {state.status === "success" ? state.message : (error ?? "")}
          </p>
        </FadeUp>
      </Container>
    </Section>
  );
}
