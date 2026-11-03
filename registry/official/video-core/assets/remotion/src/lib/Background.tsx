// A background that is never still: two soft colour fields drift on smooth noise over a faint dot grid, with a
// vignette that keeps the eye in the middle. It runs on the film's clock, so it flows across scene cuts.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import { hexA, useTheme } from "./motion";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const theme = useTheme();
  const t = frame / fps;
  const d = Math.max(width, height);
  const blob = (seed: string, cx: number, cy: number, color: string, size: number, a: number) => {
    const x = cx + noise2D(seed + "x", t * 0.07, 0) * 22;
    const y = cy + noise2D(seed + "y", 0, t * 0.07) * 16;
    return (
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: d * size,
          height: d * size,
          marginLeft: (-d * size) / 2,
          marginTop: (-d * size) / 2,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hexA(color, a)} 0%, ${hexA(color, a * 0.35)} 35%, transparent 68%)`,
        }}
      />
    );
  };
  const dot = Math.round(width / 27);
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      {blob("a", 18, 22, theme.accent, 0.95, 0.16)}
      {blob("b", 85, 78, theme.accent2, 1.05, 0.14)}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${hexA(theme.fg, 0.09)} 1.4px, transparent 1.6px)`,
          backgroundSize: `${dot}px ${dot}px`,
          backgroundPosition: `${(t * 6) % dot}px ${(t * 10) % dot}px`,
          maskImage: "radial-gradient(ellipse 75% 60% at 50% 45%, black 20%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 60% at 50% 45%, black 20%, transparent 85%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 85% 75% at 50% 45%, transparent 55%, ${hexA(theme.bg, 0.85)} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
