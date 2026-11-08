"use client";

import { m } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { EASE } from "./motion";

const BARS = 26;
/** Bar heights as a fixed pattern, so the server and the browser draw the same thing. */
const barHeight = (i: number) => 18 + ((i * 37) % 64);

/** A vertical "video frame" with a live waveform, a moving playhead and a ticking timecode. */
function Screen() {
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

const line = {
  hidden: { y: "105%" },
  show: (i: number) => ({
    y: "0%",
    transition: { duration: 0.8, delay: 0.1 + i * 0.12, ease: EASE },
  }),
};

/** The top of the page: a big plain headline that rises into place, the intro, and the frame beside it. */
export function Hero({
  label,
  lines,
  accentLine,
  intro,
  badges,
}: {
  label: ReactNode;
  lines: string[];
  accentLine: string;
  intro: string;
  badges: ReactNode;
}) {
  return (
    <header className="grid items-center gap-x-12 gap-y-10 px-4 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_17rem]">
      <div>
        <m.p
          className="hud-label text-accent-ink"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {label}
        </m.p>
        <h1 className="mt-5 text-4xl">
          {lines.map((text, i) => (
            <span key={text} className="block overflow-hidden pb-[0.12em]">
              <m.span className="block" variants={line} custom={i} initial="hidden" animate="show">
                {text}
              </m.span>
            </span>
          ))}
          <span className="block overflow-hidden pb-[0.12em]">
            <m.span
              className="block font-serif italic font-normal text-accent-ink"
              variants={line}
              custom={lines.length}
              initial="hidden"
              animate="show"
            >
              {accentLine}
            </m.span>
          </span>
        </h1>
        <m.p
          className="mt-6 max-w-xl text-md text-muted"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
        >
          {intro}
        </m.p>
        <m.div
          className="mt-7 flex flex-wrap items-center gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: EASE }}
        >
          <m.a
            href="#manage"
            className="hud-label inline-flex h-11 items-center gap-3 bg-accent px-6 font-bold text-on-accent"
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.97 }}
          >
            Add it to Claude
            <span aria-hidden="true">→</span>
          </m.a>
          <m.a
            href="#ideas"
            className="hud-label inline-flex h-11 items-center border border-line-strong px-6 text-ink hover:bg-invert-bg hover:text-invert-fg"
            whileTap={{ scale: 0.97 }}
          >
            See what it makes
          </m.a>
          <div className="flex flex-wrap gap-2">{badges}</div>
        </m.div>
      </div>
      <m.div
        initial={{ opacity: 0, y: 28, rotate: 1.5 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
      >
        <Screen />
      </m.div>
    </header>
  );
}
