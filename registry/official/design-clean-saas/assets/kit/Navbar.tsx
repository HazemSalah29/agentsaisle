"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface NavbarLink {
  label: string;
  href: string;
}

export interface NavbarProps {
  /** Product name or logo. Links to the home page. */
  logo: ReactNode;
  links: readonly NavbarLink[];
  /** The one primary call to action. */
  cta: NavbarLink;
}

const linkClass =
  "text-body text-muted transition-colors duration-(--duration-hover) hover:text-ink";
const ctaClass =
  "inline-flex items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-body font-medium text-ground transition-colors duration-(--duration-hover) hover:bg-brand-800";

/** Sticky top bar. Gains a bottom border once the page scrolls; collapses to a sheet on a phone. */
export function Navbar({ logo, links, cta }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 bg-ground border-b transition-colors duration-(--duration-hover) ${
        scrolled || open ? "border-border" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <a href="/" className="text-lead font-semibold tracking-tight text-ink">
          {logo}
        </a>
        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </a>
          ))}
          <a href={cta.href} className={ctaClass}>
            {cta.label}
          </a>
        </nav>
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls="kit-nav-sheet"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-ink md:hidden"
        >
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>
      {open ? (
        <nav
          id="kit-nav-sheet"
          aria-label="Main"
          data-fade-load=""
          className="absolute inset-x-0 top-16 flex h-[calc(100svh-4rem)] flex-col gap-1 border-t border-border bg-ground px-6 py-6 md:hidden"
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="border-b border-border py-4 text-h4 font-medium tracking-tight text-ink"
            >
              {l.label}
            </a>
          ))}
          <a href={cta.href} onClick={() => setOpen(false)} className={`${ctaClass} mt-6`}>
            {cta.label}
          </a>
        </nav>
      ) : null}
    </header>
  );
}
