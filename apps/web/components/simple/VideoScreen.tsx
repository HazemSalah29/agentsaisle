"use client";

import { m } from "framer-motion";
import { useEffect, useState } from "react";

const BARS = 26;
/** Bar heights as a fixed pattern, so the server and the browser draw the same thing. */
const barHeight = (i: number) => 18 + ((i * 37) % 64);

/** A vertical "video frame" with a live waveform, a moving playhead and a ticking timecode. */
export function VideoScreen() {
  const [second, setSecond] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = setInterval(() => setSecond((s) => (s + 1) % 43), 1000);
    return () => clearInterval(id);
  }, []);
  const time = `00:${String(second).padStart(2, "0")}`;

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto aspect-[9/16] w-full max-w-60 overflow-hidden border border-line-strong bg-bg-sunken"
    >
      <div className="hud-label absolute inset-x-0 top-0 flex justify-between border-b border-line bg-bg-raised px-3 py-2 text-muted">
        <span>9:16</span>
        <span className="text-accent-ink">{time}</span>
      </div>
      <div className="absolute inset-x-3 top-14 bottom-16 flex items-end gap-[3px]">
        {Array.from({ length: BARS }, (_, i) => (
          <m.span
            key={i}
            className="block flex-1 origin-bottom bg-accent"
            style={{ height: `${barHeight(i)}%` }}
            animate={{ scaleY: [1, 0.35, 0.85, 0.5, 1] }}
            transition={{
              duration: 1.8 + (i % 5) * 0.3,
              delay: i * 0.04,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <div className="absolute inset-x-3 bottom-8 h-px bg-line-strong" />
      <m.span
        className="absolute bottom-8 left-3 block h-[3px] w-[calc(100%-1.5rem)] origin-left bg-ink"
        animate={{ scaleX: [0, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />
      <m.span
        className="hud-label absolute inset-x-0 bottom-2 text-center text-muted"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      >
        Rendering
      </m.span>
    </div>
  );
}
