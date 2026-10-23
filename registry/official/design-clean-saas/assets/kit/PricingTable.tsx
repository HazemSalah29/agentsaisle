"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Container } from "./Container";
import { FadeUp } from "./FadeUp";
import { Grid } from "./Grid";
import { Section } from "./Section";

export interface Tier {
  name: string;
  description: string;
  /** Price per month when billed monthly. 0 shows "Free". */
  monthly: number;
  /** Price per month when billed yearly. */
  yearly: number;
  features: readonly string[];
  cta: { label: string; href: string };
  /** Marks the recommended tier with a "Most popular" tag. Use for one tier only. */
  popular?: boolean;
}

export interface PricingTableProps {
  title: string;
  intro?: string;
  /** 2 or 3 tiers. */
  tiers: readonly Tier[];
  /** Currency symbol. Default "$". */
  currency?: string;
  /** Shown beside the Yearly option, such as "Save 20%". */
  yearlyNote?: string;
  tone?: "default" | "subtle";
}

type Billing = "monthly" | "yearly";

/** Tier cards with a monthly/yearly switch. The popular tier gets an ink border and a tag. */
export function PricingTable({
  title,
  intro,
  tiers,
  currency = "$",
  yearlyNote,
  tone = "default",
}: PricingTableProps) {
  const [billing, setBilling] = useState<Billing>("monthly");
  const option = (value: Billing, label: string, note?: string) => (
    <button
      type="button"
      aria-pressed={billing === value}
      onClick={() => setBilling(value)}
      className={`rounded-lg px-4 py-2 text-body font-medium transition-colors duration-(--duration-hover) ${
        billing === value ? "bg-ground text-ink shadow-soft" : "text-muted hover:text-ink"
      }`}
    >
      {label}
      {note ? <span className="ml-2 text-caption text-brand-700">{note}</span> : null}
    </button>
  );

  return (
    <Section tone={tone}>
      <Container>
        <FadeUp className="mx-auto max-w-2xl text-center">
          <h2 className="text-h2 font-semibold text-ink">{title}</h2>
          {intro ? <p className="mt-4 text-lead text-muted">{intro}</p> : null}
          <div
            role="group"
            aria-label="Billing period"
            className="mt-8 inline-flex gap-1 rounded-lg bg-subtle p-1"
          >
            {option("monthly", "Monthly")}
            {option("yearly", "Yearly", yearlyNote)}
          </div>
        </FadeUp>
        <Grid cols={tiers.length === 2 ? 2 : 3} className="mx-auto mt-12 max-w-5xl">
          {tiers.map((t) => {
            const price = billing === "monthly" ? t.monthly : t.yearly;
            return (
              <article
                key={t.name}
                className={`relative flex flex-col rounded-2xl bg-ground p-8 ${
                  t.popular ? "border-2 border-ink" : "border border-border"
                }`}
              >
                {t.popular ? (
                  <p className="absolute -top-3 left-8 rounded-full bg-ink px-3 py-0.5 text-caption font-medium text-ground">
                    Most popular
                  </p>
                ) : null}
                <h3 className="text-lead font-semibold text-ink">{t.name}</h3>
                <p className="mt-1 text-body text-muted">{t.description}</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-h3 font-semibold tracking-tight text-ink">
                    {price === 0 ? "Free" : `${currency}${price}`}
                  </span>
                  {price === 0 ? null : <span className="text-body text-muted">per month</span>}
                </p>
                <p className="mt-1 min-h-6 text-caption text-muted">
                  {price === 0 ? "" : billing === "yearly" ? "Billed yearly" : "Billed monthly"}
                </p>
                <a
                  href={t.cta.href}
                  className={`mt-6 inline-flex items-center justify-center rounded-lg px-4 py-3 text-body font-medium transition-colors duration-(--duration-hover) ${
                    t.popular
                      ? "bg-brand-700 text-ground hover:bg-brand-800"
                      : "border border-border text-ink hover:bg-subtle"
                  }`}
                >
                  {t.cta.label}
                </a>
                <ul className="mt-8 space-y-3 border-t border-border pt-8">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-body text-ink">
                      <Check size={18} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </Grid>
      </Container>
    </Section>
  );
}
