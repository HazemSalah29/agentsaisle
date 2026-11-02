/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React from "react";
import { Composition } from "remotion";
import film from "./film.json";
import { Film } from "./Film";

export const Root = () => (
  <Composition
    id="main"
    component={Film}
    durationInFrames={film.frames}
    fps={film.fps}
    width={film.width}
    height={film.height}
  />
);
