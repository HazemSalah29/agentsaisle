"use client";

import { useActionState } from "react";
import { submitContact } from "./actions";
import { initialFormState, type FormState } from "./validate";
import { Container } from "./Container";
import { Section } from "./Section";

export interface ContactFormProps {
  title: string;
  intro?: string;
  /** A server action `(previousState, formData) => FormState`. Default: the stub in `actions.ts`. */
  action?: (prev: FormState, data: FormData) => Promise<FormState>;
  tone?: "default" | "subtle";
}

const field =
  "mt-2 w-full rounded-lg border bg-ground px-4 py-3 text-body text-ink placeholder:text-muted transition-colors duration-(--duration-hover)";

/** Labeled inputs with clear error text. Errors use the warning color; success uses the success color. */
export function ContactForm({
  title,
  intro,
  action = submitContact,
  tone = "default",
}: ContactFormProps) {
  // TODO(verify): useActionState signature against the React version in use (React 19: [state, action, pending]).
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const err = state.errors;
  const input = (name: string, label: string, type: string, autoComplete: string) => (
    <div>
      <label htmlFor={`cf-${name}`} className="text-body font-medium text-ink">
        {label}
      </label>
      <input
        id={`cf-${name}`}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        aria-invalid={err[name] ? true : undefined}
        aria-describedby={err[name] ? `cf-${name}-error` : undefined}
        className={`${field} ${err[name] ? "border-warning" : "border-border"}`}
      />
      {err[name] ? (
        <p id={`cf-${name}-error`} className="mt-2 text-caption text-warning">
          {err[name]}
        </p>
      ) : null}
    </div>
  );

  return (
    <Section tone={tone}>
      <Container className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <h2 className="text-h2 font-semibold text-ink">{title}</h2>
          {intro ? <p className="mt-4 text-lead text-muted">{intro}</p> : null}
        </div>
        <form action={formAction} noValidate className="space-y-6 md:col-span-7">
          {input("name", "Name", "text", "name")}
          {input("email", "Work email", "email", "email")}
          <div>
            <label htmlFor="cf-message" className="text-body font-medium text-ink">
              Message
            </label>
            <textarea
              id="cf-message"
              name="message"
              rows={5}
              required
              aria-invalid={err.message ? true : undefined}
              aria-describedby={err.message ? "cf-message-error" : undefined}
              className={`${field} ${err.message ? "border-warning" : "border-border"}`}
            />
            {err.message ? (
              <p id="cf-message-error" className="mt-2 text-caption text-warning">
                {err.message}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-6 py-3 text-body font-medium text-ground transition-colors duration-(--duration-hover) hover:bg-brand-800 disabled:opacity-60"
          >
            {pending ? "Sending" : "Send message"}
          </button>
          <p
            role="status"
            className={`text-body ${state.status === "success" ? "text-success" : "text-warning"}`}
          >
            {state.status === "success"
              ? state.message
              : state.status === "error"
                ? "Fix the fields above and send again."
                : ""}
          </p>
        </form>
      </Container>
    </Section>
  );
}
