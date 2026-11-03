// Fine film grain over everything. An SVG noise texture moved to a new offset every other frame, so it shimmers
// like film instead of looking like a flat digital fill. Deterministic: the offset is a function of the frame.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

const NOISE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
  );

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const k = Math.floor(frame / 2);
  const x = (k * 73) % 240;
  const y = (k * 151) % 240;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("${NOISE}")`,
        backgroundPosition: `${x}px ${y}px`,
        opacity: 0.07,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};
