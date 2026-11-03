// Kinetic type: each spoken word slams in on its syllable, key words light up in the accent colour with a punch,
// phrases clear out with a slide, drop, blur or a shatter of letters. An accent background makes it a "slab": one
// giant word on a block of colour, used for rhythm.
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { DISPLAY } from "../fonts";
import { EASE_IN, EASE_IN_OUT, ease, glow, hexA, pop, useScene, useTheme } from "../lib/motion";
import { panel } from "../lib/Stage";

type Word = { text: string; at: number; emph: boolean };
type Phrase = { start: number; end: number; words: Word[] };
type Card = {
  title: string;
  x: number;
  y: number;
  tilt: [number, number];
  at: number;
  rows: { text: string; tag?: string; at: number }[];
};

/** A cheap repeatable random number in [0, 1) from a string. */
const rnd = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

function exitOf(exit: string, k: number, key: string): React.CSSProperties {
  if (k <= 0) return {};
  const e = EASE_IN(Math.min(1, k));
  switch (exit) {
    case "drop":
      return {
        transform: `translateY(${e * 45}%) rotate(${(rnd(key) - 0.5) * 14 * e}deg)`,
        opacity: 1 - e,
      };
    case "blur":
      return { filter: `blur(${e * 24}px)`, opacity: 1 - e, transform: `scale(${1 + 0.15 * e})` };
    case "none":
      return {};
    default:
      return { transform: `translateY(${-e * 30}%)`, opacity: 1 - e, filter: `blur(${e * 8}px)` };
  }
}

const PhraseView: React.FC<{ p: Phrase; idx: number; exit: string; slab: boolean; y: number }> = ({
  p,
  idx,
  exit,
  slab,
  y,
}) => {
  const { t, fps, u, vertical } = useScene();
  const theme = useTheme();
  const longest = Math.max(...p.words.map((w) => w.text.length), 3);
  const n = p.words.length;
  const base = slab ? 30 : n === 1 ? 27 : n === 2 ? 22 : n === 3 ? 17 : 14;
  const size = Math.min(base, (vertical ? 92 : 60) / (0.46 * longest)) * (vertical ? 1 : 0.6);
  const outK = ease(t, p.end - 0.02, 0.24, EASE_IN_OUT);
  const shatter = exit === "shatter" && outK > 0;
  return (
    <div
      style={{
        position: "absolute",
        left: "6%",
        right: "6%",
        top: `${y}%`,
        transform: "translateY(-50%)",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        gap: `${size * u * 0.14}px ${size * u * 0.22}px`,
        lineHeight: 1.04,
        ...(shatter ? {} : exitOf(exit, outK, `${idx}`)),
      }}
    >
      {p.words.map((w, i) => {
        if (t < w.at) return null;
        const s = pop(t, fps, w.at, { damping: 11, stiffness: 260, mass: 0.55 });
        const color = slab ? theme.bg : w.emph ? theme.accent : theme.fg;
        const letters = shatter ? w.text.split("") : [w.text];
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: DISPLAY,
              fontSize: size * u * (w.emph && !slab ? 1.08 : 1),
              textTransform: "uppercase",
              letterSpacing: "0.005em",
              color,
              opacity: Math.min(1, s * 3),
              transform: `translateY(${(1 - s) * 30}%) scale(${0.35 + 0.65 * s})`,
              textShadow:
                w.emph && !slab
                  ? glow(theme.accent, 2.4 * u, 0.55)
                  : slab
                    ? "none"
                    : `0 ${0.6 * u}px ${2 * u}px rgba(0,0,0,0.5)`,
            }}
          >
            {letters.map((ch, k) => {
              if (!shatter) return ch;
              const key = `${idx}-${i}-${k}`;
              const dx = (rnd(key) - 0.5) * 60;
              const dy = (rnd(key + "y") - 0.3) * 70;
              const r = (rnd(key + "r") - 0.5) * 120;
              return (
                <span
                  key={k}
                  style={{
                    display: "inline-block",
                    transform: `translate(${dx * outK}%, ${dy * outK}%) rotate(${r * outK}deg)`,
                    opacity: 1 - outK,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
};

const CardView: React.FC<{ c: Card }> = ({ c }) => {
  const { t, fps, u } = useScene();
  const theme = useTheme();
  const s = pop(t, fps, c.at, { damping: 15, stiffness: 140 });
  return (
    <div
      style={{
        position: "absolute",
        left: `${c.x}%`,
        top: `${c.y}%`,
        width: 70 * u,
        transform: `translate(-50%, -50%) perspective(${120 * u}px) rotateX(${c.tilt[0] * (1.6 - 0.6 * s)}deg) rotateY(${c.tilt[1] * (1.6 - 0.6 * s)}deg) scale(${0.7 + 0.3 * s})`,
        opacity: Math.min(1, s * 1.6),
        ...panel(theme, u, 3),
        padding: 3.4 * u,
      }}
    >
      <div style={{ fontSize: 4.4 * u, fontWeight: 900, marginBottom: 2 * u, color: theme.accent }}>
        {c.title}
      </div>
      {c.rows.map((r, i) => {
        const k = pop(t, fps, r.at, { damping: 16, stiffness: 200 });
        return (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: `${1.4 * u}px 0`,
              borderTop: `${0.2 * u}px solid ${hexA(theme.fg, 0.08)}`,
              fontSize: 3.8 * u,
              fontWeight: 700,
              opacity: t < r.at ? 0.15 : 1,
              transform: `translateX(${(1 - k) * 8 * u}px)`,
            }}
          >
            <span>{r.text}</span>
            {r.tag ? (
              <span
                style={{
                  fontSize: 2.8 * u,
                  fontWeight: 800,
                  padding: `${0.4 * u}px ${1.4 * u}px`,
                  borderRadius: u,
                  background: hexA(theme.accent, 0.18),
                  color: theme.accent,
                }}
              >
                {r.tag}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

const FlowView: React.FC<{ nodes: string[]; at: number }> = ({ nodes, at }) => {
  const { t, fps, u } = useScene();
  const theme = useTheme();
  const step = 0.35;
  const k = interpolate(t, [at, at + step * nodes.length + 0.6], [0, nodes.length - 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: "8%",
        right: "8%",
        top: "66%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2.6 * u,
      }}
    >
      {nodes.map((n, i) => {
        const s = pop(t, fps, at + i * step, { damping: 13, stiffness: 200 });
        const lit = Math.round(k) === i;
        return (
          <div
            key={i}
            style={{
              ...panel(theme, u, 2.4),
              padding: `${1.6 * u}px ${4 * u}px`,
              fontSize: 4 * u,
              fontWeight: 800,
              transform: `scale(${s})`,
              borderColor: lit ? theme.accent : hexA(theme.fg, 0.14),
              boxShadow: lit ? glow(theme.accent, 2.4 * u, 0.5) : undefined,
            }}
          >
            {n}
          </div>
        );
      })}
    </div>
  );
};

export const Kinetic: React.FC<{
  bg: "black" | "dark" | "accent";
  exit: string;
  y: number;
  phrases: Phrase[];
  cards: Card[];
  flow: { nodes: string[]; at: number } | null;
}> = ({ bg, exit, y, phrases, cards, flow }) => {
  const { t } = useScene();
  const theme = useTheme();
  const slab = bg === "accent";
  const live = phrases.map((p, i) => ({ p, i })).filter(({ p }) => t >= p.start && t < p.end + 0.3);
  // The newest phrase, and the one before it while it clears out.
  const shown = live.slice(-2);
  const hits = phrases.flatMap((p) => p.words.filter((w) => w.emph).map((w) => w.at));
  const punch = hits.reduce(
    (acc, at) => acc + (t >= at ? Math.exp(-(t - at) * 9) * Math.max(0, 1 - (t - at) * 2) : 0),
    0,
  );
  return (
    <AbsoluteFill
      style={{
        background: slab ? theme.accent : "transparent",
        transform: `scale(${1 + 0.03 * Math.min(1, punch)})`,
      }}
    >
      {shown.map(({ p, i }) => (
        <PhraseView key={i} p={p} idx={i} exit={exit} slab={slab} y={y} />
      ))}
      {cards.map((c, i) => (
        <CardView key={i} c={c} />
      ))}
      {flow ? <FlowView nodes={flow.nodes} at={flow.at} /> : null}
    </AbsoluteFill>
  );
};
