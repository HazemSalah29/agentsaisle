import React from "react";
import { Composition } from "remotion";
import { Film } from "./Film";
import type { Film as FilmData } from "./types";

// A placeholder so Remotion Studio opens without props; real renders always pass the film.
const EMPTY: FilmData = {
  width: 1080,
  height: 1920,
  fps: 30,
  frames: 30,
  lang: "en",
  dir: "ltr",
  theme: {
    preset: "volt",
    bg: "#06070a",
    fg: "#f5f7fa",
    accent: "#c6ff1a",
    accent2: "#5ce1ff",
    muted: "#8b93a1",
    danger: "#ff4d5e",
    ok: "#3ddc84",
    font: "Inter",
  },
  style: { captions: "none", progress: false, grain: true, background: "aurora" },
  captions: [],
  scenes: [
    {
      id: "hello",
      kind: "title",
      from: 0,
      frames: 30,
      transition: { type: "cut", frames: 0 },
      props: { text: "Hello *video*" },
    },
  ],
};

export const Root: React.FC = () => (
  <Composition
    id="main"
    component={Film}
    defaultProps={{ film: EMPTY }}
    durationInFrames={30}
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={({ props }) => ({
      durationInFrames: props.film.frames,
      fps: props.film.fps,
      width: props.film.width,
      height: props.film.height,
    })}
  />
);
