// Scenes built on the user's own media: a still or clip with a slow camera move, and a screen recording inside
// an original device frame with a camera that follows the action, a cursor, click ripples and callouts.
import React from "react";
import { AbsoluteFill, Freeze, Img, OffthreadVideo, staticFile } from "remotion";
import { EASE_IN_OUT, glow, hexA, pop, riseIn, useScene, useTheme } from "../lib/motion";
import { Pill, Stage, panel } from "../lib/Stage";

const Media: React.FC<{
  src: string;
  media: string;
  fit: "cover" | "contain" | "fill";
  style?: React.CSSProperties;
}> = ({ src, media, fit, style }) => {
  const s: React.CSSProperties = { width: "100%", height: "100%", objectFit: fit, ...style };
  return media === "video" ? (
    <OffthreadVideo src={staticFile(src)} muted style={s} />
  ) : (
    <Img src={staticFile(src)} style={s} />
  );
};

export const Broll: React.FC<{
  src: string;
  media: string;
  fit: "cover" | "contain";
  caption?: string;
}> = ({ src, media, fit, caption }) => {
  const { t, fps, u, seconds } = useScene();
  const theme = useTheme();
  const k = Math.max(0, Math.min(1, t / Math.max(1, seconds)));
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{ transform: `scale(${1.04 + 0.08 * k}) translateX(${(k - 0.5) * -2}%)` }}
      >
        <Media src={src} media={media} fit={fit} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${hexA(theme.bg, 0.35)} 0%, transparent 30%, transparent 55%, ${hexA(theme.bg, 0.8)} 100%)`,
        }}
      />
      {caption ? (
        <div
          style={{
            position: "absolute",
            left: "7%",
            right: "7%",
            top: "13%",
            fontSize: 6.4 * u,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            textShadow: "0 4px 24px rgba(0,0,0,0.6)",
            ...riseIn(t, fps, 0.15),
          }}
        >
          {caption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

type Zoom = { at: number; dur: number; x: number; y: number; scale: number };
type Pt = { t: number; x: number; y: number };

function cursorAt(points: Pt[], t: number) {
  if (!points.length) return null;
  if (t <= points[0].t) return points[0];
  for (let i = 1; i < points.length; i++)
    if (t <= points[i].t) {
      const a = points[i - 1];
      const b = points[i];
      const k = EASE_IN_OUT((t - a.t) / Math.max(0.001, b.t - a.t));
      return { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  return points[points.length - 1];
}

/**
 * Where the camera looks (0 to 1 across the recording) and how close, at time t. Zooms from the plan ease in, hold
 * and ease out. When `follow` is set (a tall frame showing a wide recording) the camera otherwise trails the cursor,
 * a little behind it, so the action stays in the window.
 */
function camera(zoom: Zoom[], cursor: Pt[], t: number, follow: boolean) {
  let x = 0.5;
  let y = 0.5;
  if (follow && cursor.length) {
    let sx = 0;
    let sy = 0;
    for (let k = 0; k < 6; k++) {
      const p = cursorAt(cursor, t - k * 0.12)!;
      sx += p.x;
      sy += p.y;
    }
    x = sx / 6;
    y = sy / 6;
  }
  // Following a wide recording in a tall window, the camera sits a little closer so the interface is readable.
  const base = follow ? 1.3 : 1;
  let s = base;
  for (const z of zoom) {
    const ramp = Math.min(0.6, z.dur / 3);
    const inK = EASE_IN_OUT(Math.max(0, Math.min(1, (t - z.at) / ramp)));
    const outK = EASE_IN_OUT(Math.max(0, Math.min(1, (t - (z.at + z.dur - ramp)) / ramp)));
    const k = inK * (1 - outK);
    if (k > 0) {
      x += (z.x - x) * k;
      y += (z.y - y) * k;
      s = base * (1 + (z.scale - 1) * k);
    }
  }
  return { x, y, s };
}

const Chrome: React.FC<{ device: string; children: React.ReactNode; w: number; h: number }> = ({
  device,
  children,
  w,
  h,
}) => {
  const { u } = useScene();
  const theme = useTheme();
  const screen = (radius: number) => (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "hidden",
        background: "#000",
        borderRadius: radius,
      }}
    >
      {children}
    </div>
  );
  if (device === "none") return <div style={{ alignSelf: "center" }}>{screen(2.4 * u)}</div>;
  if (device === "phone")
    return (
      <div
        style={{
          alignSelf: "center",
          padding: 2 * u,
          borderRadius: 9 * u,
          background: "#0b0c0f",
          border: `${0.5 * u}px solid ${hexA(theme.fg, 0.18)}`,
          boxShadow: `0 ${4 * u}px ${12 * u}px rgba(0,0,0,0.6)`,
        }}
      >
        {screen(7 * u)}
      </div>
    );
  return (
    <div style={{ alignSelf: "center" }}>
      <div
        style={{
          borderRadius: 2.4 * u,
          overflow: "hidden",
          border: `${0.3 * u}px solid ${hexA(theme.fg, 0.16)}`,
          boxShadow: `0 ${4 * u}px ${14 * u}px rgba(0,0,0,0.65), ${glow(theme.accent, 6 * u, 0.12)}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 1.3 * u,
            padding: `${1.6 * u}px ${2.4 * u}px`,
            background: "#16181d",
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span
              key={c}
              style={{ width: 1.9 * u, height: 1.9 * u, borderRadius: "50%", background: c }}
            />
          ))}
          <span
            style={{
              flex: 1,
              marginLeft: 2 * u,
              height: 3.2 * u,
              borderRadius: 2 * u,
              background: hexA(theme.fg, 0.08),
            }}
          />
        </div>
        {screen(0)}
      </div>
      {device === "laptop" ? (
        <div
          style={{
            height: 2.2 * u,
            margin: "0 -4%",
            borderRadius: `0 0 ${2 * u}px ${2 * u}px`,
            background: "linear-gradient(180deg,#2a2d33,#15171b)",
          }}
        />
      ) : null}
    </div>
  );
};

export const Screen: React.FC<{
  src: string;
  media: string;
  device: string;
  viewport: { w: number; h: number };
  zoom: Zoom[];
  cursor: Pt[];
  ripples: Pt[];
  title?: string;
  callouts: { text: string; at: number }[];
  mediaSeconds: number | null;
}> = ({ src, media, device, viewport, zoom, cursor, ripples, title, callouts, mediaSeconds }) => {
  const { t, fps, u, width, vertical } = useScene();
  const theme = useTheme();
  const rec = viewport.w / viewport.h;
  // A tall frame gets a taller window onto a wide recording, and the camera follows the action inside it.
  const follow = vertical && device !== "phone" && rec > 1.1;
  const winW = (device === "phone" ? 58 : vertical ? 86 : 80) * u;
  const winH = follow ? winW / 1.15 : winW / rec;
  const baseH = rec >= winW / winH ? winH : winW / rec;
  const baseW = baseH * rec;
  const cam = camera(zoom, cursor, t, follow);
  const W = baseW * cam.s;
  const H = baseH * cam.s;
  const tx = Math.min(0, Math.max(winW - W, winW / 2 - cam.x * W));
  const ty = Math.min(0, Math.max(winH - H, winH / 2 - cam.y * H));
  const cur = cursorAt(cursor, t);
  const lift = pop(t, fps, 0, { damping: 18, stiffness: 120 });
  const callout = callouts.filter((c) => t >= c.at).at(-1);
  const frozen = mediaSeconds !== null && t > mediaSeconds - 1 / fps;
  return (
    <Stage gap={3}>
      <div style={{ minHeight: 10 * u, display: "flex", alignItems: "flex-end" }}>
        {callout ? (
          <div
            key={callout.at}
            style={{
              display: "inline-flex",
              ...panel(theme, u, 2.4),
              padding: `${1.8 * u}px ${3.2 * u}px`,
              fontSize: 5.6 * u,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              borderLeft: `${0.9 * u}px solid ${theme.accent}`,
              ...riseIn(t, fps, callout.at, 30),
            }}
          >
            {callout.text}
          </div>
        ) : (
          <Pill text={title} />
        )}
      </div>
      <div
        style={{
          alignSelf: "center",
          transform: `perspective(${3 * width}px) rotateX(${(1 - lift) * 14}deg) translateY(${(1 - lift) * 10 * u}px)`,
          opacity: Math.min(1, lift * 1.5),
        }}
      >
        <Chrome device={device} w={winW} h={winH}>
          <div style={{ position: "absolute", left: tx, top: ty, width: W, height: H }}>
            {frozen ? (
              <Freeze frame={Math.max(0, Math.round(mediaSeconds! * fps) - 2)}>
                <Media src={src} media={media} fit="fill" />
              </Freeze>
            ) : (
              <Media src={src} media={media} fit="fill" />
            )}
            {ripples
              .filter((r) => t >= r.t && t < r.t + 0.6)
              .map((r, i) => {
                const k = (t - r.t) / 0.6;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: 9 * u,
                      height: 9 * u,
                      margin: -4.5 * u,
                      borderRadius: "50%",
                      border: `${0.7 * u}px solid ${theme.accent}`,
                      transform: `scale(${0.3 + k * 1.4})`,
                      opacity: 1 - k,
                    }}
                  />
                );
              })}
            {cur ? (
              <svg
                viewBox="0 0 24 24"
                style={{
                  position: "absolute",
                  left: `${cur.x * 100}%`,
                  top: `${cur.y * 100}%`,
                  width: 5 * u,
                  height: 5 * u,
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
                }}
              >
                <path
                  d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.4 L18 13.4 Z"
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </div>
        </Chrome>
      </div>
    </Stage>
  );
};
