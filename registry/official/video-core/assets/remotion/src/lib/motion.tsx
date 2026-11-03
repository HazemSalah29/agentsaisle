// Motion helpers every scene uses. Everything is a function of the frame, so a frame always looks the same.
import React, { createContext, useContext } from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Film, Theme } from "../types";

export const FilmContext = createContext<Film | null>(null);
/** Frames the scene starts before its own clock (the transition into it). */
export const SceneContext = createContext<{ lead: number; frames: number }>({ lead: 0, frames: 1 });

export const useFilm = (): Film => {
  const f = useContext(FilmContext);
  if (!f) throw new Error("FilmContext missing");
  return f;
};
export const useTheme = (): Theme => useFilm().theme;

/** The scene's own clock: `t` seconds since the scene began (negative during the transition into it). */
export function useScene() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { lead, frames } = useContext(SceneContext);
  const f = frame - lead;
  const vertical = height > width;
  return {
    frame: f,
    t: f / fps,
    fps,
    seconds: frames / fps,
    width,
    height,
    vertical,
    // One unit is 1% of the frame width, so layouts scale with the format.
    u: width / 100,
  };
}

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);

/** 0 before `at`, 1 after `at + dur`, eased in between. */
export const ease = (t: number, at: number, dur: number, fn = EASE_OUT) =>
  interpolate(t, [at, at + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: fn,
  });

/** A spring that starts at `at` seconds. Snappy by default, with a little overshoot. */
export const pop = (
  t: number,
  fps: number,
  at: number,
  config: { damping?: number; stiffness?: number; mass?: number } = {},
) =>
  spring({
    frame: Math.max(0, (t - at) * fps),
    fps,
    config: { damping: 14, stiffness: 170, mass: 0.6, ...config },
  });

/** Style for an element that rises in at `at`: from below, blurred and transparent, to sharp and in place. */
export function riseIn(
  t: number,
  fps: number,
  at: number,
  distance = 40,
  blur = 14,
): React.CSSProperties {
  const s = pop(t, fps, at, { damping: 18, stiffness: 140 });
  const o = ease(t, at, 0.22);
  return {
    opacity: o,
    transform: `translateY(${(1 - s) * distance}px) scale(${0.96 + 0.04 * s})`,
    filter: `blur(${(1 - o) * blur}px)`,
  };
}

/** Text with *starred* words drawn in the accent colour. */
export function Marked({ text, accent }: { text: string; accent: string }) {
  const parts = String(text)
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") ? (
          <span key={i} style={{ color: accent }}>
            {p.slice(1, -1)}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

/** Words that come in one after another, each rising and un-blurring; *starred* words take the accent. */
export function WordsIn({
  text,
  at,
  stagger = 0.06,
  style,
  accent,
  distance = 50,
}: {
  text: string;
  at: number;
  stagger?: number;
  style?: React.CSSProperties;
  accent?: string;
  distance?: number;
}) {
  const { t, fps } = useScene();
  const theme = useTheme();
  const words = String(text).split(/\s+/).filter(Boolean);
  return (
    <span style={style}>
      {words.map((w, i) => {
        const marked = /^\*.+\*[.,!?:;]?$/.test(w);
        const clean = w.replace(/\*/g, "");
        const s = riseIn(t, fps, at + i * stagger, distance);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              ...s,
              color: marked ? (accent ?? theme.accent) : undefined,
            }}
          >
            {clean}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}

/** A bar that fills across [from, to]: shows how long the voice stays on an item. */
export function Rail({
  from,
  to,
  color,
  height = 6,
}: {
  from: number;
  to: number;
  color: string;
  height?: number;
}) {
  const { t } = useScene();
  const k = interpolate(t, [from, Math.max(from + 0.2, to)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        height,
        borderRadius: height,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{ width: `${k * 100}%`, height: "100%", background: color, borderRadius: height }}
      />
    </div>
  );
}

/** A soft glow behind an element, in a colour. */
export const glow = (color: string, size = 40, strength = 0.55) =>
  `0 0 ${size}px ${hexA(color, strength)}, 0 0 ${size * 2.5}px ${hexA(color, strength * 0.35)}`;

/** A hex colour with an alpha. */
export function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Where content may sit in a vertical frame, clear of the platform's buttons and the captions (in % of height). */
export const SAFE = { top: 11, bottom: 64, side: 7 };
