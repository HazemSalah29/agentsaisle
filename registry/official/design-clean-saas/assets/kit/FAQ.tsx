"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { Container } from "./Container";
import { FadeUp } from "./FadeUp";
import { Section } from "./Section";

export interface Question {
  question: string;
  answer: string;
}

export interface FAQProps {
  title: string;
  items: readonly Question[];
  tone?: "default" | "subtle";
}

/** An accessible accordion: each question is a button that controls its answer. One open at a time. */
export function FAQ({ title, items, tone = "default" }: FAQProps) {
  const [open, setOpen] = useState<number | null>(null);
  const base = useId();

  return (
    <Section tone={tone}>
      <Container className="grid gap-12 md:grid-cols-12">
        <FadeUp className="md:col-span-4">
          <h2 className="text-h2 font-semibold text-ink">{title}</h2>
        </FadeUp>
        <FadeUp className="md:col-span-8" delay={50}>
          <ul className="border-t border-border">
            {items.map((item, i) => {
              const isOpen = open === i;
              const buttonId = `${base}-q${i}`;
              const panelId = `${base}-a${i}`;
              return (
                <li key={item.question} className="border-b border-border">
                  <h3>
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-6 py-5 text-left text-lead font-medium text-ink"
                    >
                      {item.question}
                      <ChevronDown
                        size={20}
                        aria-hidden="true"
                        className={`shrink-0 text-muted transition-transform duration-(--duration-hover) ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </h3>
                  <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen}>
                    <p className="pb-5 text-body text-muted">{item.answer}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </FadeUp>
      </Container>
    </Section>
  );
}
