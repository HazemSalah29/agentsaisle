// The area a scene draws in, clear of the platform's buttons and of the captions, plus the small heading pill
// most scenes open with.
import React from "react";
import { AbsoluteFill } from "remotion";
import { SAFE, hexA, riseIn, useFilm, useScene, useTheme } from "./motion";

export const Stage: React.FC<{
  children: React.ReactNode;
  justify?: React.CSSProperties["justifyContent"];
  gap?: number;
  full?: boolean;
}> = ({ children, justify = "center", gap = 3, full = false }) => {
  const { u, vertical } = useScene();
  const film = useFilm();
  const bottom = film.style.captions === "none" || full ? 88 : SAFE.bottom;
  return (
    <AbsoluteFill
      style={{
        paddingTop: `${vertical ? SAFE.top : 8}%`,
        paddingBottom: `${100 - (vertical ? bottom : 74)}%`,
        paddingLeft: `${SAFE.side}%`,
        paddingRight: `${SAFE.side}%`,
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        alignItems: "stretch",
        gap: gap * u,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** A small rounded label with an accent dot: the scene's title, kept short. */
export const Pill: React.FC<{ text?: string; at?: number }> = ({ text, at = 0 }) => {
  const { t, fps, u } = useScene();
  const theme = useTheme();
  if (!text) return null;
  return (
    <div style={{ display: "flex", ...riseIn(t, fps, at, 24, 8) }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 1.6 * u,
          padding: `${1.1 * u}px ${2.6 * u}px`,
          borderRadius: 99 * u,
          background: hexA(theme.fg, 0.07),
          border: `${0.25 * u}px solid ${hexA(theme.fg, 0.14)}`,
          fontSize: 3.4 * u,
          fontWeight: 700,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: hexA(theme.fg, 0.86),
        }}
      >
        <span
          style={{
            width: 1.6 * u,
            height: 1.6 * u,
            borderRadius: u,
            background: theme.accent,
            boxShadow: `0 0 ${2 * u}px ${theme.accent}`,
          }}
        />
        {text}
      </div>
    </div>
  );
};

/** A glassy panel: the base for cards, windows and boxes. */
export const panel = (
  theme: { fg: string; bg: string },
  u: number,
  radius = 3.2,
): React.CSSProperties => ({
  background: `linear-gradient(160deg, ${hexA(theme.fg, 0.085)}, ${hexA(theme.fg, 0.035)})`,
  border: `${0.22 * u}px solid ${hexA(theme.fg, 0.13)}`,
  borderRadius: radius * u,
  boxShadow: `0 ${3 * u}px ${8 * u}px rgba(0,0,0,0.45), inset 0 ${0.2 * u}px 0 ${hexA(theme.fg, 0.08)}`,
  backdropFilter: "blur(6px)",
});
