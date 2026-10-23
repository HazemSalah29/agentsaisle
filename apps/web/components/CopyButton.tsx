"use client";

import { useEffect, useRef, useState } from "react";

/** Copies `text`. Reports "copied" for a moment, or "failed" when the clipboard is unavailable. */
export function useCopy(text: string) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = setTimeout(() => setState("idle"), 2400);
  }
  return { state, copy };
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const { state, copy } = useCopy(text);
  const copied = state === "copied";
  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={`hud-label inline-flex h-11 min-w-28 items-center justify-center gap-2 px-5 font-bold ${
          copied ? "bg-accent text-on-accent" : "bg-invert-bg text-invert-fg hover:opacity-80"
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          {copied ? (
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          ) : (
            <>
              <rect x="9" y="9" width="11" height="11" />
              <path d="M5 15V5a1 1 0 0 1 1-1h10" />
            </>
          )}
        </svg>
        {copied ? "Copied" : state === "failed" ? "Select text" : label}
      </button>
      <span role="status" className="sr-only">
        {copied
          ? "Copied to clipboard"
          : state === "failed"
            ? "Could not copy. Select the command and copy it."
            : ""}
      </span>
    </>
  );
}
