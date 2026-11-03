// Burned captions in the short-form style: two or three words at a time, big and heavy, the spoken word lit in
// the accent colour and nudged up as it is said. They sit above the platform's bottom buttons.
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { hexA, pop, useFilm } from "./motion";
import type { CaptionPage } from "../types";

export const Captions: React.FC<{ pages: CaptionPage[] }> = ({ pages }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { theme, style } = useFilm();
  const t = frame / fps;
  const page = pages.find((p) => t >= p.start - 0.04 && t < p.end);
  if (!page) return null;
  const vertical = height > width;
  const size = vertical ? width * 0.068 : height * 0.065;
  const enter = pop(t, fps, page.start - 0.04, { damping: 13, stiffness: 220, mass: 0.5 });
  const karaoke = style.captions === "karaoke";
  return (
    <div
      style={{
        position: "absolute",
        left: "6%",
        right: "6%",
        top: vertical ? "70%" : "80%",
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: `0 ${size * 0.34}px`,
        transform: `scale(${0.85 + 0.15 * enter})`,
        opacity: Math.min(1, enter * 2),
      }}
    >
      {page.words.map((w, i) => {
        const spoken = t >= w.start - 0.03;
        const active = spoken && t < w.end + 0.05;
        const lift = active
          ? pop(t, fps, w.start - 0.03, { damping: 12, stiffness: 260, mass: 0.4 })
          : 0;
        const color = karaoke
          ? spoken
            ? theme.accent
            : theme.fg
          : active
            ? theme.accent
            : theme.fg;
        return (
          <span
            key={i}
            style={{
              fontSize: size,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              textTransform: style.captions === "clean" ? "none" : "uppercase",
              color,
              lineHeight: 1.1,
              display: "inline-block",
              transform: `translateY(${-lift * size * 0.08}px) scale(${1 + lift * 0.05})`,
              transformOrigin: "50% 100%",
              textShadow: `0 ${size * 0.06}px 0 ${hexA("#000000", 0.9)}, 0 0 ${size * 0.5}px ${hexA("#000000", 0.6)}`,
              WebkitTextStroke: `${size * 0.035}px rgba(0,0,0,0.85)`,
              paintOrder: "stroke fill",
            }}
          >
            {w.text.replace(/[,;:]$/, "")}
          </span>
        );
      })}
    </div>
  );
};
