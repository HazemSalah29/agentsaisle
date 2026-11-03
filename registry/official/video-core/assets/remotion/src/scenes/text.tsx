// Scenes made of words: the hook title, a quote, lists, a big number, a versus card and steps.
import React from "react";
import { interpolate } from "remotion";
import {
  Marked,
  Rail,
  WordsIn,
  ease,
  glow,
  hexA,
  pop,
  riseIn,
  useScene,
  useTheme,
} from "../lib/motion";
import { Pill, Stage, panel } from "../lib/Stage";

type Timed = { text: string; at: number };

/** Font size (in units) for a headline: as big as fits, smaller for longer lines. */
const headline = (text: string, vertical: boolean) => {
  const n = text.replace(/\*/g, "").length;
  const base = vertical ? 13 : 7.5;
  return Math.max(vertical ? 8.8 : 4.4, Math.min(base, base * Math.sqrt(30 / Math.max(10, n))));
};

export const Title: React.FC<{ text: string; subtitle?: string; kicker?: string }> = ({
  text,
  subtitle,
  kicker,
}) => {
  const { t, fps, u, vertical } = useScene();
  const theme = useTheme();
  const size = headline(text, vertical);
  const words = text.split(/\s+/).length;
  const subAt = 0.15 + words * 0.07;
  const bar = ease(t, subAt, 0.6);
  return (
    <Stage gap={4}>
      {kicker ? <Pill text={kicker} /> : null}
      <div
        style={{
          fontSize: size * u,
          fontWeight: 900,
          lineHeight: 0.98,
          letterSpacing: "-0.045em",
          textWrap: "balance",
        }}
      >
        <WordsIn text={text} at={0} stagger={0.07} distance={size * u * 0.5} />
      </div>
      <div
        style={{
          height: 1.4 * u,
          width: `${bar * 34}%`,
          background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`,
          borderRadius: u,
          boxShadow: glow(theme.accent, 2 * u, 0.6),
        }}
      />
      {subtitle ? (
        <div
          style={{
            fontSize: (vertical ? 5.2 : 2.8) * u,
            fontWeight: 600,
            color: hexA(theme.fg, 0.72),
            lineHeight: 1.25,
            ...riseIn(t, fps, subAt + 0.1),
          }}
        >
          <Marked text={subtitle} accent={theme.accent} />
        </div>
      ) : null}
    </Stage>
  );
};

export const Quote: React.FC<{ text: string; by?: string; source?: string }> = ({
  text,
  by,
  source,
}) => {
  const { t, fps, u, vertical } = useScene();
  const theme = useTheme();
  const words = text.split(/\s+/).length;
  const mark = pop(t, fps, 0);
  return (
    <Stage gap={3}>
      <div
        style={{
          fontFamily: "Georgia, serif",
          fontSize: 30 * u,
          lineHeight: 0.6,
          height: 12 * u,
          color: theme.accent,
          transform: `scale(${mark})`,
          transformOrigin: "left top",
          textShadow: glow(theme.accent, 3 * u, 0.5),
        }}
      >
        “
      </div>
      <div
        style={{
          fontSize: (vertical ? (words > 22 ? 6.2 : 7.4) : 3.8) * u,
          fontWeight: 800,
          lineHeight: 1.12,
          letterSpacing: "-0.03em",
        }}
      >
        <WordsIn text={text} at={0.2} stagger={0.045} />
      </div>
      {by ? (
        <div
          style={{
            fontSize: 4 * u,
            fontWeight: 600,
            color: hexA(theme.fg, 0.65),
            ...riseIn(t, fps, 0.4 + words * 0.045),
          }}
        >
          — {by}
          {source ? <span style={{ color: hexA(theme.fg, 0.45) }}> · {source}</span> : null}
        </div>
      ) : null}
    </Stage>
  );
};

export const List: React.FC<{
  heading?: string;
  numbered: boolean;
  layout: "stack" | "spotlight";
  items: Timed[];
}> = ({ heading, numbered, layout, items }) => {
  const { t, fps, u, seconds, vertical } = useScene();
  const theme = useTheme();
  const until = (i: number) => items[i + 1]?.at ?? seconds - 0.1;
  if (layout === "spotlight") {
    const cur = Math.max(
      0,
      items.findLastIndex((x) => t >= x.at),
    );
    return (
      <Stage justify="space-between">
        <Pill text={heading} />
        <div style={{ position: "relative", flex: 1 }}>
          {items.map((it, i) => {
            const inS = pop(t, fps, it.at, { damping: 16, stiffness: 150 });
            const out = i < items.length - 1 ? ease(t, until(i) - 0.05, 0.25) : 0;
            if (t < it.at - 0.05 || out >= 1) return null;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 3 * u,
                  opacity: Math.min(1, inS * 1.5) * (1 - out),
                  transform: `translateY(${(1 - inS) * 12 * u - out * 10 * u}px) scale(${0.94 + 0.06 * inS})`,
                  filter: `blur(${(1 - Math.min(1, inS)) * 10 + out * 12}px)`,
                }}
              >
                <div
                  style={{
                    fontSize: 26 * u,
                    fontWeight: 900,
                    lineHeight: 0.85,
                    color: "transparent",
                    WebkitTextStroke: `${0.45 * u}px ${theme.accent}`,
                    letterSpacing: "-0.05em",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div
                  style={{
                    fontSize: (vertical ? (it.text.length > 32 ? 8 : 10) : 5) * u,
                    fontWeight: 900,
                    lineHeight: 1.02,
                    letterSpacing: "-0.04em",
                  }}
                >
                  <Marked text={it.text} accent={theme.accent} />
                </div>
                <div style={{ width: "62%" }}>
                  <Rail from={it.at} to={until(i)} color={theme.accent} height={1.1 * u} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 1.6 * u }}>
          {items.map((_, i) => (
            <div
              key={i}
              style={{
                height: 1.2 * u,
                width: i === cur ? 7 * u : 2.4 * u,
                borderRadius: u,
                background: i <= cur ? theme.accent : hexA(theme.fg, 0.2),
              }}
            />
          ))}
        </div>
      </Stage>
    );
  }
  return (
    <Stage gap={2.6}>
      <Pill text={heading} />
      {items.map((it, i) => {
        const active = t >= it.at && t < until(i);
        const done = t >= until(i) && i < items.length - 1;
        return (
          <div
            key={i}
            style={{
              ...panel(theme, u, 3),
              display: "flex",
              alignItems: "center",
              gap: 3 * u,
              padding: `${3 * u}px ${3.6 * u}px`,
              ...riseIn(t, fps, it.at, 30),
              opacity: t < it.at ? 0 : done ? 0.45 : 1,
              borderColor: active ? hexA(theme.accent, 0.7) : hexA(theme.fg, 0.13),
              boxShadow: active ? glow(theme.accent, 3 * u, 0.25) : undefined,
            }}
          >
            <div
              style={{
                flex: "none",
                width: 9 * u,
                height: 9 * u,
                borderRadius: 2.4 * u,
                display: "grid",
                placeItems: "center",
                background: active ? theme.accent : hexA(theme.fg, 0.1),
                color: active ? theme.bg : theme.fg,
                fontSize: 4.6 * u,
                fontWeight: 900,
              }}
            >
              {numbered ? i + 1 : "✓"}
            </div>
            <div
              style={{
                fontSize: 5.6 * u,
                fontWeight: 800,
                lineHeight: 1.12,
                letterSpacing: "-0.02em",
              }}
            >
              <Marked text={it.text} accent={theme.accent} />
            </div>
          </div>
        );
      })}
    </Stage>
  );
};

export const NumberScene: React.FC<{
  value: number;
  from: number;
  unit: string;
  prefix: string;
  decimals: number;
  label: string;
  at: number;
}> = ({ value, from, unit, prefix, decimals, label, at }) => {
  const { t, fps, u, vertical } = useScene();
  const theme = useTheme();
  const k = ease(t, at, 1.2, (x) => 1 - Math.pow(1 - x, 4));
  const v = from + (value - from) * k;
  const text = v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const landed = pop(t, fps, at + 1.2, { damping: 9, stiffness: 260, mass: 0.5 });
  const shown = `${prefix}${text}${unit}`;
  const size = Math.min(vertical ? 30 : 16, (vertical ? 150 : 80) / Math.max(3, shown.length));
  return (
    <Stage gap={3}>
      <div
        style={{
          fontSize: size * u,
          fontWeight: 900,
          letterSpacing: "-0.06em",
          lineHeight: 0.9,
          color: theme.accent,
          fontVariantNumeric: "tabular-nums",
          textShadow: glow(theme.accent, 5 * u, 0.45),
          transform: `scale(${1 + 0.06 * Math.sin(Math.PI * Math.min(1, landed))})`,
          transformOrigin: "left center",
          ...riseIn(t, fps, Math.max(0, at - 0.1), 30, 10),
        }}
      >
        {shown}
      </div>
      <div
        style={{
          fontSize: (vertical ? 6.4 : 3.2) * u,
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          ...riseIn(t, fps, at + 0.3),
        }}
      >
        <Marked text={label} accent={theme.accent} />
      </div>
      <div style={{ width: "70%", ...riseIn(t, fps, at + 0.4, 10, 0) }}>
        <Rail from={at} to={at + 1.2} color={theme.accent} height={1.2 * u} />
      </div>
    </Stage>
  );
};

type Side = { title: string; at: number; points: Timed[] };
export const Versus: React.FC<{
  title?: string;
  left: Side;
  right: Side;
  verdict: Timed | null;
}> = ({ title, left, right, verdict }) => {
  const { t, fps, u, vertical } = useScene();
  const theme = useTheme();
  const card = (s: Side, dir: -1 | 1, color: string) => {
    const k = pop(t, fps, s.at, { damping: 16, stiffness: 130 });
    return (
      <div
        style={{
          ...panel(theme, u, 3.6),
          flex: 1,
          padding: `${4 * u}px ${3.6 * u}px`,
          display: "flex",
          flexDirection: "column",
          gap: 2.4 * u,
          transform: `translateX(${(1 - k) * dir * 60 * u}px) rotate(${(1 - k) * dir * 6}deg)`,
          opacity: Math.min(1, k * 1.4),
          borderTop: `${0.9 * u}px solid ${color}`,
        }}
      >
        <div style={{ fontSize: 6.2 * u, fontWeight: 900, letterSpacing: "-0.03em", color }}>
          {s.title}
        </div>
        {s.points.map((p, i) => (
          <div
            key={i}
            style={{
              fontSize: 4.3 * u,
              fontWeight: 700,
              lineHeight: 1.2,
              display: "flex",
              gap: 1.6 * u,
              ...riseIn(t, fps, p.at, 20, 6),
            }}
          >
            <span style={{ color }}>•</span>
            <span>{p.text}</span>
          </div>
        ))}
      </div>
    );
  };
  const vs = pop(t, fps, Math.max(left.at, right.at) + 0.1, {
    damping: 8,
    stiffness: 240,
    mass: 0.5,
  });
  return (
    <Stage gap={3}>
      <Pill text={title} />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: vertical ? "column" : "row",
          gap: 5 * u,
        }}
      >
        {card(left, -1, theme.accent2)}
        {card(right, 1, theme.accent)}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 14 * u,
            height: 14 * u,
            margin: -7 * u,
            borderRadius: "50%",
            background: theme.fg,
            color: theme.bg,
            display: "grid",
            placeItems: "center",
            fontSize: 5.4 * u,
            fontWeight: 900,
            transform: `scale(${vs}) rotate(${(1 - vs) * -90}deg)`,
            boxShadow: `0 0 0 ${1.2 * u}px ${theme.bg}`,
          }}
        >
          VS
        </div>
      </div>
      {verdict ? (
        <div
          style={{
            alignSelf: "flex-start",
            background: theme.accent,
            color: theme.bg,
            fontSize: 4.8 * u,
            fontWeight: 900,
            padding: `${1.6 * u}px ${3 * u}px`,
            borderRadius: 2 * u,
            ...riseIn(t, fps, verdict.at, 30),
          }}
        >
          {verdict.text}
        </div>
      ) : null}
    </Stage>
  );
};

type Step = { label: string; detail?: string; at: number };
export const Steps: React.FC<{ title?: string; layout: "stack" | "spotlight"; steps: Step[] }> = ({
  title,
  steps,
}) => {
  const { t, fps, u } = useScene();
  const theme = useTheme();
  const cur = steps.findLastIndex((s) => t >= s.at);
  const lineK = interpolate(t, [steps[0].at, steps.at(-1)!.at + 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Stage gap={3}>
      <Pill text={title} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4.2 * u }}>
        <div
          style={{
            position: "absolute",
            left: 5.5 * u - 0.3 * u,
            top: 5 * u,
            bottom: 5 * u,
            width: 0.6 * u,
            background: hexA(theme.fg, 0.12),
            borderRadius: u,
          }}
        >
          <div
            style={{
              height: `${lineK * 100}%`,
              background: theme.accent,
              borderRadius: u,
              boxShadow: glow(theme.accent, 1.5 * u),
            }}
          />
        </div>
        {steps.map((s, i) => {
          const on = i === cur;
          const done = i < cur;
          const k = pop(t, fps, s.at, { damping: 12, stiffness: 200 });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 4 * u,
                alignItems: "flex-start",
                opacity: t < s.at - 0.05 ? 0.25 : done ? 0.55 : 1,
              }}
            >
              <div
                style={{
                  flex: "none",
                  width: 11 * u,
                  height: 11 * u,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900,
                  fontSize: 5 * u,
                  background: on || done ? theme.accent : theme.bg,
                  color: on || done ? theme.bg : hexA(theme.fg, 0.6),
                  border: `${0.5 * u}px solid ${on || done ? theme.accent : hexA(theme.fg, 0.25)}`,
                  transform: `scale(${t >= s.at ? 0.8 + 0.2 * k : 0.8})`,
                  boxShadow: on ? glow(theme.accent, 3 * u, 0.5) : undefined,
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  paddingTop: 1.4 * u,
                  ...riseIn(t, fps, s.at, 20, 6),
                  opacity: t < s.at - 0.05 ? 0.35 : 1,
                }}
              >
                <div
                  style={{
                    fontSize: (on ? 6.4 : 5.4) * u,
                    fontWeight: 900,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.08,
                  }}
                >
                  <Marked text={s.label} accent={theme.accent} />
                </div>
                {s.detail ? (
                  <div
                    style={{
                      fontSize: 3.8 * u,
                      fontWeight: 600,
                      color: hexA(theme.fg, 0.62),
                      marginTop: u,
                      lineHeight: 1.25,
                    }}
                  >
                    {s.detail}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};
