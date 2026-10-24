"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { duration, ease, stagger } from "./tokens";
import { useMotionOk } from "./use-motion-ok";

export interface NavLink {
  label: string;
  href: string;
}

export interface NavOverlayProps {
  /** Studio or person name, shown top left. Links home. */
  brand: string;
  links: readonly NavLink[];
  /** Text of the availability pill, such as "Available from March". Leave out to hide it. */
  available?: string;
}

/** A slim bar that opens a full-screen menu. Links rise in one after another. */
export function NavOverlay({ brand, links, available }: NavOverlayProps) {
  const [open, setOpen] = useState(false);
  const motionOk = useMotionOk();
  const firstLink = useRef<HTMLAnchorElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
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
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-gutter py-4 mix-blend-difference">
        <a href="/" className="font-display text-xl tracking-tight text-ink uppercase">
          {brand}
        </a>
        <div className="flex items-center gap-4">
          {available ? (
            <span className="hidden items-center gap-2 rounded-full border border-ink px-4 py-1 text-sm text-ink sm:inline-flex">
              <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
              {available}
            </span>
          ) : null}
          <button
            ref={button}
            type="button"
            aria-expanded={open}
            aria-controls="kit-nav-overlay"
            onClick={() => setOpen((o) => !o)}
            className="relative z-50 rounded-full border border-ink px-5 py-2 text-sm font-medium text-ink"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </header>
      <AnimatePresence>
        {open ? (
          <m.nav
            id="kit-nav-overlay"
            aria-label="Main"
            className="fixed inset-0 z-30 flex flex-col justify-center bg-ground px-gutter"
            initial={motionOk ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.base, ease: ease.outExpo }}
          >
            <ul className="flex flex-col gap-2">
              {links.map((link, i) => (
                <li key={link.href} className="overflow-hidden">
                  <m.a
                    ref={i === 0 ? firstLink : undefined}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block font-display text-display text-ink uppercase transition-colors hover:text-accent"
                    initial={motionOk ? { y: "110%" } : false}
                    animate={{ y: "0%" }}
                    transition={{
                      duration: duration.slow,
                      ease: ease.outExpo,
                      delay: 0.15 + i * stagger.item,
                    }}
                  >
                    {link.label}
                  </m.a>
                </li>
              ))}
            </ul>
          </m.nav>
        ) : null}
      </AnimatePresence>
    </>
  );
}
