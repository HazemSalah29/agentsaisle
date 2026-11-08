"use client";

import { AnimatePresence, m } from "framer-motion";
import { useId, useState, type ReactNode } from "react";
import { EASE } from "./motion";

/** A button that opens and closes a panel with a smooth height change. Content is only in the page while open. */
export function MoreDetails({
  title,
  hint,
  children,
  defaultOpen = false,
  tone = "plain",
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: "plain" | "boxed";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={tone === "boxed" ? "border border-line-strong bg-bg-raised" : ""}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-invert-bg hover:text-invert-fg"
      >
        <span>
          <span className="block text-base font-medium">{title}</span>
          {hint && <span className="mt-0.5 block text-sm opacity-70">{hint}</span>}
        </span>
        <m.span
          aria-hidden="true"
          className="hud-label flex h-8 w-8 shrink-0 items-center justify-center border border-current"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          +
        </m.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={id}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-2 pb-5">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
