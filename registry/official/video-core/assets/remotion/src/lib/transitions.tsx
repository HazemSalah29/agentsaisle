// How a scene arrives and how the one before leaves. `k` runs 0 to 1 over the transition. Fast moves carry a blur
// proportional to their speed, which reads as motion blur at a fraction of the render cost.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, useTheme } from "./motion";
import type { TransitionType } from "../types";

const c = (k: number) => Math.max(0, Math.min(1, k));
const speedBlur = (k: number, peak: number) => Math.sin(Math.PI * c(k)) * peak;

export function enterStyle(
  type: TransitionType,
  k: number,
): { wrap: React.CSSProperties; overlay?: React.ReactNode } {
  if (k >= 1 || type === "cut") return { wrap: {} };
  switch (type) {
    case "fade":
      return { wrap: { opacity: EASE_IN_OUT(c(k)) } };
    case "slide": {
      const e = EASE_OUT(c(k));
      return {
        wrap: { transform: `translateY(${(1 - e) * 100}%)`, filter: `blur(${speedBlur(k, 10)}px)` },
      };
    }
    case "whip": {
      const e = EASE_IN_OUT(c(k));
      return {
        wrap: { transform: `translateX(${(1 - e) * 100}%)`, filter: `blur(${speedBlur(k, 28)}px)` },
      };
    }
    case "zoom-through":
    case "shatter": {
      const e = EASE_OUT(c(k));
      return {
        wrap: {
          transform: `scale(${0.55 + 0.45 * e})`,
          opacity: interpolate(k, [0, 0.45], [0, 1], { extrapolateRight: "clamp" }),
          filter: `blur(${(1 - e) * 22}px)`,
        },
      };
    }
    case "slash":
      return { wrap: { clipPath: slashClip(c(k)) }, overlay: <SlashLine k={c(k)} /> };
    default:
      return { wrap: {} };
  }
}

export function exitStyle(type: TransitionType, k: number): React.CSSProperties {
  if (k <= 0) return {};
  const kk = c(k);
  switch (type) {
    case "slide":
      return {
        transform: `translateY(${-EASE_OUT(kk) * 28}%) scale(${1 - 0.06 * kk})`,
        opacity: 1 - 0.6 * kk,
      };
    case "whip":
      return {
        transform: `translateX(${-EASE_IN_OUT(kk) * 100}%)`,
        filter: `blur(${speedBlur(kk, 28)}px)`,
      };
    case "zoom-through":
    case "shatter":
      return {
        transform: `scale(${1 + EASE_IN(kk) * 1.6})`,
        opacity: 1 - kk,
        filter: `blur(${kk * 18}px)`,
      };
    case "fade":
      return { opacity: 1 - EASE_IN_OUT(kk) * 0.4 };
    case "slash":
      return { transform: `translate(${-kk * 6}%, ${kk * 6}%)`, opacity: 1 - 0.3 * kk };
    default:
      return {};
  }
}

/** A diagonal edge sweeping from the top-right corner to the bottom-left. */
const slashClip = (k: number) => {
  const e = EASE_IN_OUT(k);
  const a = -40 + e * 240;
  return `polygon(${a}% 0%, 140% 0%, 140% 100%, ${a - 40}% 100%)`;
};

const SlashLine: React.FC<{ k: number }> = ({ k }) => {
  const theme = useTheme();
  const e = EASE_IN_OUT(k);
  const a = -40 + e * 240;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ overflow: "visible" }}
      >
        <line
          x1={a}
          y1={0}
          x2={a - 40}
          y2={100}
          stroke={theme.accent}
          strokeWidth={0.9}
          style={{ filter: `drop-shadow(0 0 1.5px ${theme.accent})` }}
        />
      </svg>
    </AbsoluteFill>
  );
};

/** A short white flash that lands on a hard cut. Rendered inside an 8-frame Sequence. */
export const Flash: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 2, 8], [0, 0.55, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#ffffff", opacity: o, mixBlendMode: "screen" }} />;
};
