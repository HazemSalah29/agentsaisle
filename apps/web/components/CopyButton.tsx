"use client";

import { useEffect, useRef, useState } from "react";

/** Copies `text`. Reports "copied" for a moment, or "failed" when the clipboard is unavailable. */
export function useCopy(text: string) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      setCount((c) => c + 1);
    } catch {
      setState("failed");
    }
    timer.current = setTimeout(() => setState("idle"), 2600);
  }
  return { state, count, copy };
}

export function CopyButton({ text, label = "Copy command" }: { text: string; label?: string }) {
  const { state, count, copy } = useCopy(text);
  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center gap-2 rounded-sticker border-[1.5px] border-label-rule bg-sticker px-5 font-display text-md font-extrabold text-on-sticker shadow-label-sm hover:-translate-y-px active:translate-x-px active:translate-y-px active:shadow-none"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="11" height="11" rx="1" />
          <path d="M5 15V5a1 1 0 0 1 1-1h10" />
        </svg>
        {label}
      </button>
      <span role="status" className="sr-only">
        {state === "copied"
          ? "Copied to clipboard"
          : state === "failed"
            ? "Could not copy. Select the command and copy it."
            : ""}
      </span>
      {state === "copied" && (
        // Re-keyed on every copy so the stamp lands again each time.
        <span
          key={count}
          aria-hidden="true"
          className="animate-stamp pointer-events-none absolute -top-3 right-4 rotate-[-6deg] rounded-label border-2 border-label-rule bg-label px-3 py-1 font-display text-lg font-black text-label-ink"
        >
          Copied
        </span>
      )}
      {state === "failed" && (
        <span
          aria-hidden="true"
          className="absolute -top-3 right-4 rounded-label border-2 border-label-rule bg-label px-3 py-1 font-display text-md font-bold text-label-ink"
        >
          Select and copy
        </span>
      )}
    </>
  );
}
