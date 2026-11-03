// Developer scenes: a code editor that types itself and spotlights lines, a terminal, and charts.
import React from "react";
import { interpolate } from "remotion";
import { evolvePath } from "@remotion/paths";
import { MONO } from "../fonts";
import { Marked, ease, glow, hexA, pop, riseIn, useScene, useTheme } from "../lib/motion";
import { Pill, Stage, panel } from "../lib/Stage";

type Tok = { t: string; c: string };
type Row = { kind: "same" | "add" | "del"; tokens: Tok[] };

const WindowBar: React.FC<{ name?: string }> = ({ name }) => {
  const { u } = useScene();
  const theme = useTheme();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 1.5 * u,
        padding: `${2 * u}px ${3 * u}px`,
        borderBottom: `${0.2 * u}px solid ${hexA(theme.fg, 0.08)}`,
      }}
    >
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <span
          key={c}
          style={{ width: 2.2 * u, height: 2.2 * u, borderRadius: "50%", background: c }}
        />
      ))}
      {name ? (
        <span
          style={{
            marginLeft: 2 * u,
            fontFamily: MONO,
            fontSize: 3.1 * u,
            color: hexA(theme.fg, 0.55),
          }}
        >
          {name}
        </span>
      ) : null}
    </div>
  );
};

export const Code: React.FC<{
  title?: string;
  file?: string;
  rows: Row[];
  lineAts: number[];
  focus: { from: number; to: number; at: number }[];
  diffAt: number | null;
}> = ({ title, file, rows, lineAts, focus, diffAt }) => {
  const { t, fps, u, vertical } = useScene();
  const theme = useTheme();
  const longest = Math.max(...rows.map((r) => r.tokens.map((x) => x.t).join("").length), 16);
  // JetBrains Mono is 0.6 em wide; leave room for the line numbers and the panel's padding.
  const size = Math.min(vertical ? 4.4 : 2.2, ((vertical ? 86 : 60) - 13) / (0.6 * longest));
  const lineH = size * 1.62;
  const f = focus.filter((x) => t >= x.at).at(-1);
  const fk = f ? ease(t, f.at, 0.35) : 0;
  const win = pop(t, fps, 0, { damping: 18, stiffness: 120 });
  const diffK = diffAt === null ? 1 : ease(t, diffAt, 0.5);
  let n = 0;
  return (
    <Stage gap={3}>
      <Pill text={title} />
      <div
        style={{
          ...panel({ fg: theme.fg, bg: theme.bg }, u, 3),
          background: "linear-gradient(170deg, rgba(22,27,34,0.96), rgba(13,17,23,0.96))",
          overflow: "hidden",
          // The camera leans in on the lines being talked about.
          transform: `perspective(${200 * u}px) rotateX(${(1 - win) * 18}deg) translateY(${(1 - win) * 20 * u}px) scale(${1 + 0.02 * fk})`,
          transformOrigin: f
            ? `50% ${((f.from + f.to) / 2 / Math.max(1, rows.length)) * 100}%`
            : "50% 50%",
          opacity: Math.min(1, win * 1.5),
        }}
      >
        <WindowBar name={file} />
        <div
          style={{
            position: "relative",
            padding: `${2.4 * u}px 0`,
            fontFamily: MONO,
            fontSize: size * u,
            lineHeight: `${lineH * u}px`,
          }}
        >
          {f ? (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 2.4 * u + (f.from - 1) * lineH * u,
                height: (f.to - f.from + 1) * lineH * u,
                background: hexA(theme.accent, 0.1 * fk),
                borderLeft: `${0.8 * u}px solid ${hexA(theme.accent, fk)}`,
                boxShadow: `inset 0 0 ${4 * u}px ${hexA(theme.accent, 0.12 * fk)}`,
              }}
            />
          ) : null}
          {rows.map((r, i) => {
            const at = lineAts[i] ?? 0;
            const shown = interpolate(t, [at, at + 0.22], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const lineNo = r.kind === "del" ? "" : String(++n);
            const inFocus = !f || (n >= f.from && n <= f.to && r.kind !== "del");
            const dim = f ? 1 - 0.7 * fk * (inFocus ? 0 : 1) : 1;
            const isAdd = r.kind === "add";
            const isDel = r.kind === "del";
            const diffShow = isAdd ? diffK : 1;
            const strike = isDel ? diffK : 0;
            if (isAdd && diffK <= 0) return null;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  whiteSpace: "pre",
                  opacity: dim * diffShow * (isDel ? 1 - 0.5 * strike : 1),
                  clipPath: `inset(0 ${(1 - shown) * 100}% 0 0)`,
                  background: isAdd
                    ? hexA(theme.ok, 0.14)
                    : isDel
                      ? hexA(theme.danger, 0.14 * strike)
                      : undefined,
                  textDecoration: isDel && strike > 0.5 ? "line-through" : undefined,
                  textDecorationColor: theme.danger,
                }}
              >
                <span
                  style={{
                    width: 8 * u,
                    flex: "none",
                    textAlign: "right",
                    paddingRight: 2.4 * u,
                    color: isAdd ? theme.ok : isDel ? theme.danger : hexA(theme.fg, 0.25),
                  }}
                >
                  {isAdd ? "+" : isDel ? "−" : lineNo}
                </span>
                <span>
                  {r.tokens.map((tk, k) => (
                    <span key={k} style={{ color: tk.c }}>
                      {tk.t}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

export const Terminal: React.FC<{
  title?: string;
  prompt: string;
  lines: { text: string; kind: "cmd" | "out"; at: number }[];
}> = ({ title, prompt, lines }) => {
  const { t, fps, u } = useScene();
  const theme = useTheme();
  const CPS = 30;
  const win = pop(t, fps, 0, { damping: 18, stiffness: 120 });
  const typing = lines.find((l) => l.kind === "cmd" && t >= l.at && t < l.at + l.text.length / CPS);
  return (
    <Stage gap={3}>
      <Pill text={title} />
      <div
        style={{
          ...panel(theme, u, 3),
          background: "rgba(8,10,14,0.94)",
          overflow: "hidden",
          transform: `scale(${0.92 + 0.08 * win})`,
          opacity: Math.min(1, win * 1.5),
        }}
      >
        <WindowBar name="terminal" />
        <div
          style={{
            padding: `${3 * u}px ${3.4 * u}px`,
            fontFamily: MONO,
            fontSize: 4 * u,
            lineHeight: 1.55,
            display: "flex",
            flexDirection: "column",
            gap: 0.8 * u,
          }}
        >
          {lines.map((l, i) => {
            if (t < l.at) return null;
            const isCmd = l.kind === "cmd";
            const chars = isCmd ? Math.floor((t - l.at) * CPS) : l.text.length;
            const out = isCmd ? l.text.slice(0, chars) : l.text;
            const caret = typing === l && Math.floor(t * 2.5) % 2 === 0;
            return (
              <div
                key={i}
                style={{
                  whiteSpace: "pre-wrap",
                  color: isCmd ? theme.fg : hexA(theme.fg, 0.62),
                  ...(isCmd ? {} : riseIn(t, fps, l.at, 10, 4)),
                }}
              >
                {isCmd ? (
                  <span style={{ color: theme.accent, fontWeight: 700 }}>{prompt} </span>
                ) : null}
                {out}
                {caret ? (
                  <span style={{ background: theme.accent, color: theme.bg }}> </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

export const Chart: React.FC<{
  title?: string;
  type: "bar" | "line";
  unit: string;
  data: { label: string; value: number; at: number }[];
}> = ({ title, type, unit, data }) => {
  const { t, fps, u, vertical } = useScene();
  const theme = useTheme();
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const min = Math.min(0, ...data.map((d) => d.value));
  const top = data.reduce((a, b) => (b.value > a.value ? b : a));
  const H = (vertical ? 62 : 30) * u;
  const fmt = (v: number) => `${Math.round(v).toLocaleString("en-US")}${unit}`;
  if (type === "line") {
    const W = 86 * u;
    const pts = data.map(
      (d, i) =>
        [(i / (data.length - 1)) * W, H - ((d.value - min) / (max - min || 1)) * H] as const,
    );
    const path = pts
      .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
      .join(" ");
    const k = interpolate(t, [data[0].at, data.at(-1)!.at + 0.4], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const ev = evolvePath(k, path);
    return (
      <Stage gap={3}>
        <Pill text={title} />
        <svg width={W} height={H + 10 * u} style={{ overflow: "visible" }}>
          <path
            d={path}
            fill="none"
            stroke={theme.accent}
            strokeWidth={1.1 * u}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={ev.strokeDasharray}
            strokeDashoffset={ev.strokeDashoffset}
            style={{ filter: `drop-shadow(0 0 ${1.5 * u}px ${theme.accent})` }}
          />
          {pts.map((p, i) => {
            const s = pop(t, fps, data[i].at);
            return (
              <g key={i} opacity={Math.min(1, s)}>
                <circle
                  cx={p[0]}
                  cy={p[1]}
                  r={1.8 * u * s}
                  fill={theme.bg}
                  stroke={theme.accent}
                  strokeWidth={0.7 * u}
                />
                <text
                  x={p[0]}
                  y={H + 7 * u}
                  fill={hexA(theme.fg, 0.6)}
                  fontSize={3.2 * u}
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {data[i].label}
                </text>
              </g>
            );
          })}
        </svg>
      </Stage>
    );
  }
  const gap = 2.4 * u;
  return (
    <Stage gap={3}>
      <Pill text={title} />
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap,
          height: H,
          borderBottom: `${0.3 * u}px solid ${hexA(theme.fg, 0.2)}`,
        }}
      >
        {data.map((d, i) => {
          const g = pop(t, fps, d.at, { damping: 15, stiffness: 110 });
          const h = (Math.max(0, d.value) / max) * H * 0.82;
          const best = d === top;
          const col = best ? theme.accent : hexA(theme.fg, 0.78);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
              }}
            >
              <div
                style={{
                  fontSize: (data.length > 6 ? 3 : 4) * u,
                  fontWeight: 900,
                  color: col,
                  marginBottom: u,
                  opacity: Math.min(1, g),
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmt(d.value * Math.min(1, g))}
              </div>
              <div
                style={{
                  width: "100%",
                  height: h * g,
                  borderRadius: `${1.6 * u}px ${1.6 * u}px 0 0`,
                  background: best
                    ? `linear-gradient(180deg, ${theme.accent}, ${hexA(theme.accent, 0.55)})`
                    : `linear-gradient(180deg, ${hexA(theme.fg, 0.55)}, ${hexA(theme.fg, 0.18)})`,
                  boxShadow: best ? glow(theme.accent, 3 * u, 0.45) : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: (data.length > 6 ? 2.8 : 3.6) * u,
              fontWeight: 700,
              color: hexA(theme.fg, 0.7),
              ...riseIn(t, fps, d.at, 10, 4),
            }}
          >
            <Marked text={d.label} accent={theme.accent} />
          </div>
        ))}
      </div>
    </Stage>
  );
};
