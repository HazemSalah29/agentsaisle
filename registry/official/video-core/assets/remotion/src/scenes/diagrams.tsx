// Diagrams that move: a small graph, a request travelling through a system, a sequence diagram and a rate
// limiter driven by its real simulation. Positions come from resolve.mjs as percentages of the stage.
import React from "react";
import { MONO } from "../fonts";
import { EASE_IN_OUT, ease, glow, hexA, pop, riseIn, useScene, useTheme } from "../lib/motion";
import { Pill, Stage, panel } from "../lib/Stage";

type P = { x: number; y: number };

/** A box with a label that pops in at `at`; lit while `lit`. */
const Box: React.FC<{
  label: string;
  x: number;
  y: number;
  at: number;
  lit: boolean;
  w: number;
  sub?: string;
}> = ({ label, x, y, at, lit, w, sub }) => {
  const { t, fps, u } = useScene();
  const theme = useTheme();
  const s = pop(t, fps, at, { damping: 12, stiffness: 190 });
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: w,
        transform: `translate(-50%, -50%) scale(${t < at ? 0 : s})`,
        ...panel(theme, u, 2.6),
        padding: `${2.4 * u}px ${1.6 * u}px`,
        textAlign: "center",
        fontSize: 4 * u,
        fontWeight: 800,
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
        borderColor: lit ? theme.accent : hexA(theme.fg, 0.14),
        boxShadow: lit ? glow(theme.accent, 3 * u, 0.4) : panel(theme, u).boxShadow,
        background: lit
          ? `linear-gradient(160deg, ${hexA(theme.accent, 0.22)}, ${hexA(theme.accent, 0.06)})`
          : panel(theme, u).background,
        zIndex: 2,
      }}
    >
      {label}
      {sub ? (
        <div
          style={{
            fontSize: 2.8 * u,
            fontWeight: 600,
            color: hexA(theme.fg, 0.55),
            marginTop: 0.6 * u,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/** Lines between boxes in a 100x100 viewBox over the stage. */
const Edges: React.FC<{ edges: { a: P; b: P; on: number; lit: boolean }[] }> = ({ edges }) => {
  const { t } = useScene();
  const theme = useTheme();
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        zIndex: 1,
      }}
    >
      {edges.map((e, i) => {
        const k = ease(t, e.on, 0.45);
        return (
          <line
            key={i}
            x1={e.a.x}
            y1={e.a.y}
            x2={e.a.x + (e.b.x - e.a.x) * k}
            y2={e.a.y + (e.b.y - e.a.y) * k}
            stroke={e.lit ? theme.accent : hexA(theme.fg, 0.22)}
            strokeWidth={e.lit ? 0.7 : 0.45}
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: e.lit ? 6 : 4 }}
            strokeDasharray={e.lit ? undefined : "1.2 1.2"}
          />
        );
      })}
    </svg>
  );
};

/** A glowing dot moving from a to b over [at, at + dur]. */
const Packet: React.FC<{ a: P; b: P; at: number; dur: number; color?: string }> = ({
  a,
  b,
  at,
  dur,
  color,
}) => {
  const { t, u } = useScene();
  const theme = useTheme();
  if (t < at || t > at + dur + 0.05) return null;
  const k = EASE_IN_OUT(Math.min(1, (t - at) / dur));
  const c = color ?? theme.accent;
  return (
    <div
      style={{
        position: "absolute",
        left: `${a.x + (b.x - a.x) * k}%`,
        top: `${a.y + (b.y - a.y) * k}%`,
        width: 3.4 * u,
        height: 3.4 * u,
        margin: -1.7 * u,
        borderRadius: "50%",
        background: c,
        boxShadow: glow(c, 2.5 * u, 0.9),
        zIndex: 3,
      }}
    />
  );
};

export const Nodes: React.FC<{
  title?: string;
  nodes: (P & { id: string; label: string; at: number })[];
  edges: { from: string; to: string }[];
}> = ({ title, nodes, edges }) => {
  const { t, u } = useScene();
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const cur = nodes.filter((n) => t >= n.at).at(-1);
  const perRow = Math.max(...nodes.map((n) => nodes.filter((m) => Math.abs(m.y - n.y) < 1).length));
  const w = Math.min(36, 88 / perRow - 4) * u;
  return (
    <Stage gap={3}>
      <Pill text={title} />
      <div style={{ position: "relative", flex: 1 }}>
        <Edges
          edges={edges.map((e) => ({
            a: byId[e.from],
            b: byId[e.to],
            on: Math.max(byId[e.from].at, byId[e.to].at - 0.3),
            lit: cur?.id === e.to || cur?.id === e.from,
          }))}
        />
        {edges.map((e, i) => {
          const at = byId[e.to].at - 0.35;
          return <Packet key={i} a={byId[e.from]} b={byId[e.to]} at={at} dur={0.35} />;
        })}
        {nodes.map((n) => (
          <Box key={n.id} label={n.label} x={n.x} y={n.y} at={n.at} lit={cur?.id === n.id} w={w} />
        ))}
      </div>
    </Stage>
  );
};

type FlowNode = P & { id: string; label: string; role?: string; at: number };
type FlowStep = {
  from: string;
  to: string;
  label: string;
  evidence?: string;
  ms?: number;
  at: number;
  dur: number;
  event: boolean;
};
export const RequestFlow: React.FC<{
  title?: string;
  nodes: FlowNode[];
  edges: { id: string; from: string; to: string }[];
  steps: FlowStep[];
}> = ({ title, nodes, edges, steps }) => {
  const { t, fps, u } = useScene();
  const theme = useTheme();
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const cur = steps.filter((s) => t >= s.at).at(-1);
  const perRow = Math.max(...nodes.map((n) => nodes.filter((m) => Math.abs(m.y - n.y) < 1).length));
  const w = Math.min(36, 88 / perRow - 4) * u;
  return (
    <Stage gap={2.4}>
      <Pill text={title} />
      <div style={{ position: "relative", flex: 1 }}>
        <Edges
          edges={edges.map((e) => ({
            a: byId[e.from],
            b: byId[e.to],
            on: Math.max(byId[e.from].at, byId[e.to].at),
            lit: Boolean(
              cur &&
              !cur.event &&
              ((cur.from === e.from && cur.to === e.to) ||
                (cur.from === e.to && cur.to === e.from)),
            ),
          }))}
        />
        {steps.map((s, i) =>
          s.event ? null : <Packet key={i} a={byId[s.from]} b={byId[s.to]} at={s.at} dur={s.dur} />,
        )}
        {nodes.map((n) => (
          <Box
            key={n.id}
            label={n.label}
            sub={n.role}
            x={n.x}
            y={n.y}
            at={n.at}
            lit={Boolean(cur && (cur.to === n.id || (cur.event && cur.from === n.id)))}
            w={w}
          />
        ))}
      </div>
      <div style={{ minHeight: 16 * u, position: "relative" }}>
        {steps.map((s, i) => {
          const next = steps[i + 1]?.at ?? Infinity;
          if (t < s.at || t >= next) return null;
          return (
            <div
              key={i}
              style={{
                ...panel(theme, u, 2.6),
                padding: `${2.4 * u}px ${3 * u}px`,
                borderLeft: `${0.9 * u}px solid ${theme.accent}`,
                ...riseIn(t, fps, s.at, 20, 6),
              }}
            >
              <div style={{ fontSize: 4.6 * u, fontWeight: 800, lineHeight: 1.15 }}>
                <span style={{ color: theme.accent, fontFamily: MONO, marginRight: 1.6 * u }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.label}
                {s.ms !== undefined ? (
                  <span style={{ color: hexA(theme.fg, 0.55) }}> · {s.ms} ms</span>
                ) : null}
              </div>
              {s.evidence ? (
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 2.8 * u,
                    color: hexA(theme.fg, 0.5),
                    marginTop: 0.8 * u,
                  }}
                >
                  {s.evidence}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

type SeqRow =
  | { type: "msg"; from: string; to: string; text: string; dashed: boolean; at: number }
  | { type: "note"; over: string[]; text: string; at: number };
export const Sequence: React.FC<{
  title?: string;
  participants: { id: string; label: string }[];
  rows: SeqRow[];
}> = ({ title, participants, rows }) => {
  const { t, fps, u } = useScene();
  const theme = useTheme();
  const n = participants.length;
  const cx = Object.fromEntries(participants.map((p, i) => [p.id, ((i + 0.5) * 100) / n]));
  const rowH = Math.min(11, 70 / rows.length);
  const cur = rows.findLastIndex((r) => t >= r.at);
  return (
    <Stage gap={2}>
      <Pill text={title} />
      <div style={{ position: "relative", flex: 1 }}>
        {participants.map((p, i) => (
          <React.Fragment key={p.id}>
            <div
              style={{
                position: "absolute",
                left: `${cx[p.id]}%`,
                top: 0,
                transform: "translateX(-50%)",
                width: `${78 / n}%`,
                ...panel(theme, u, 2.4),
                padding: `${2 * u}px ${u}px`,
                textAlign: "center",
                fontSize: (n > 3 ? 3.6 : 4.4) * u,
                fontWeight: 800,
                ...riseIn(t, fps, i * 0.08, 20, 6),
              }}
            >
              {p.label}
            </div>
            <div
              style={{
                position: "absolute",
                left: `${cx[p.id]}%`,
                top: 10 * u,
                bottom: 0,
                width: 0,
                borderLeft: `${0.35 * u}px dashed ${hexA(theme.fg, 0.18)}`,
              }}
            />
          </React.Fragment>
        ))}
        {rows.map((r, i) => {
          const y = 16 + i * rowH;
          const k = ease(t, r.at, 0.4);
          const dim = i < cur ? 0.45 : 1;
          if (t < r.at) return null;
          if (r.type === "note") {
            const xs = r.over.map((id) => cx[id]);
            const left = Math.min(...xs) - 50 / n + 3;
            const right = Math.max(...xs) + 50 / n - 3;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: `${y}%`,
                  left: `${left}%`,
                  width: `${right - left}%`,
                  background: hexA(theme.accent2, 0.16),
                  border: `${0.25 * u}px solid ${hexA(theme.accent2, 0.5)}`,
                  borderRadius: 1.6 * u,
                  padding: `${1.2 * u}px`,
                  textAlign: "center",
                  fontSize: 3.6 * u,
                  fontWeight: 700,
                  opacity: dim * k,
                }}
              >
                {r.text}
              </div>
            );
          }
          const a = cx[r.from];
          const b = cx[r.to];
          const dir = b >= a ? 1 : -1;
          const x2 = a + (b - a) * k;
          const color = i === cur ? theme.accent : theme.fg;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: `${y}%`,
                left: 0,
                right: 0,
                height: rowH * u * 1.4,
                opacity: dim,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${Math.min(a, b)}%`,
                  width: `${Math.abs(b - a)}%`,
                  top: 0,
                  textAlign: "center",
                  fontSize: 3.8 * u,
                  fontWeight: 700,
                  color: i === cur ? theme.fg : hexA(theme.fg, 0.8),
                  opacity: k,
                }}
              >
                {r.text}
              </div>
              <svg
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 5 * u,
                  width: "100%",
                  height: 3 * u,
                  overflow: "visible",
                }}
              >
                <line
                  x1={a}
                  y1={5}
                  x2={x2}
                  y2={5}
                  stroke={color}
                  strokeWidth={5}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={r.dashed ? "10 8" : undefined}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  left: `${x2}%`,
                  top: 5 * u + 1.5 * u,
                  width: 0,
                  height: 0,
                  transform: `translate(${dir > 0 ? -100 : 0}%, -50%)`,
                  borderTop: `${1.4 * u}px solid transparent`,
                  borderBottom: `${1.4 * u}px solid transparent`,
                  [dir > 0 ? "borderLeft" : "borderRight"]: `${2.2 * u}px solid ${color}`,
                }}
              />
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

type Run = {
  algo: string;
  label: string;
  allowed: number;
  rejected: number;
  events: { t: number; ok: boolean; level: number; max: number }[];
};
export const RateLimit: React.FC<{ title?: string; travel: number; runs: Run[] }> = ({
  title,
  travel,
  runs,
}) => {
  const { t, u } = useScene();
  const theme = useTheme();
  const lane = (run: Run) => {
    const seen = run.events.filter((e) => e.t <= t);
    const ok = seen.filter((e) => e.ok).length;
    const no = seen.length - ok;
    const last = seen.at(-1);
    const level = last ? last.level / Math.max(1, last.max) : 1;
    const flying = run.events.filter((e) => t >= e.t - travel && t <= e.t + travel);
    return (
      <div
        key={run.algo}
        style={{
          ...panel(theme, u, 3),
          padding: `${3 * u}px`,
          display: "flex",
          flexDirection: "column",
          gap: 2 * u,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 4.8 * u, fontWeight: 900 }}>{run.label}</div>
          <div style={{ fontFamily: MONO, fontSize: 3.6 * u, fontWeight: 700 }}>
            <span style={{ color: theme.ok }}>{ok} ✓</span>
            <span style={{ color: hexA(theme.fg, 0.3) }}> · </span>
            <span style={{ color: theme.danger }}>{no} 429</span>
          </div>
        </div>
        <div style={{ position: "relative", height: 26 * u }}>
          {/* the gate and its bucket */}
          <div
            style={{
              position: "absolute",
              left: "52%",
              top: "8%",
              bottom: "8%",
              width: 11 * u,
              marginLeft: -5.5 * u,
              borderRadius: 2 * u,
              border: `${0.4 * u}px solid ${hexA(theme.fg, 0.3)}`,
              overflow: "hidden",
              background: hexA(theme.fg, 0.04),
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: `${level * 100}%`,
                background: `linear-gradient(0deg, ${theme.accent}, ${hexA(theme.accent, 0.5)})`,
                boxShadow: glow(theme.accent, 2 * u, 0.4),
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: "52%",
              bottom: -0.5 * u,
              transform: "translateX(-50%)",
              fontFamily: MONO,
              fontSize: 2.6 * u,
              color: hexA(theme.fg, 0.5),
            }}
          >
            {run.algo.includes("window") ? "window" : "tokens"}
          </div>
          {flying.map((e, i) => {
            const k = (t - (e.t - travel)) / travel; // 0..1 arriving, 1..2 leaving
            let x: number;
            let y = 50;
            let o = 1;
            if (k <= 1) x = 4 + k * 42;
            else if (e.ok) x = 58 + (k - 1) * 40;
            else {
              const q = k - 1;
              x = 46 - q * 6;
              y = 50 + q * q * 90;
              o = 1 - q;
            }
            const c = k <= 1 ? theme.fg : e.ok ? theme.ok : theme.danger;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  width: 3.2 * u,
                  height: 3.2 * u,
                  margin: -1.6 * u,
                  borderRadius: "50%",
                  background: c,
                  opacity: o,
                  boxShadow: k > 1 ? glow(c, 1.4 * u, 0.7) : undefined,
                }}
              />
            );
          })}
          {last && !last.ok && t - last.t < 0.35 ? (
            <div
              style={{
                position: "absolute",
                left: "30%",
                top: "62%",
                fontFamily: MONO,
                fontWeight: 900,
                fontSize: 4.4 * u,
                color: theme.danger,
                opacity: 1 - (t - last.t) / 0.35,
              }}
            >
              429
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            height: 1.4 * u,
            borderRadius: u,
            overflow: "hidden",
            background: hexA(theme.fg, 0.08),
          }}
        >
          <div
            style={{
              width: `${(100 * ok) / Math.max(1, run.events.length)}%`,
              background: theme.ok,
            }}
          />
          <div
            style={{
              width: `${(100 * no) / Math.max(1, run.events.length)}%`,
              background: theme.danger,
            }}
          />
        </div>
      </div>
    );
  };
  return (
    <Stage gap={3}>
      <Pill text={title} />
      {runs.map(lane)}
    </Stage>
  );
};
