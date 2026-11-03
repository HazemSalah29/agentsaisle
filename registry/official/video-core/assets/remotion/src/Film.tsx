// The whole film: a living background, every scene on its own clock with the transition into it and out of it,
// burned captions, a progress bar and film grain. Scenes overlap only during a transition, so the voice (mixed
// later by ffmpeg) stays on the frames timing.json gave it.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "./lib/Background";
import { Captions } from "./lib/Captions";
import { Grain } from "./lib/Grain";
import { exitStyle, enterStyle, Flash } from "./lib/transitions";
import { FilmContext, SceneContext } from "./lib/motion";
import { SCENES } from "./scenes";
import "./fonts";
import type { Film as FilmData, SceneData } from "./types";

function SceneLayer({ scene, next, lead }: { scene: SceneData; next?: SceneData; lead: number }) {
  const frame = useCurrentFrame();
  const Kind = SCENES[scene.kind];
  const local = frame - lead;
  const enter = enterStyle(scene.transition.type, lead ? Math.min(1, frame / lead) : 1);
  const outFrames = next?.transition.frames ?? 0;
  const exit =
    outFrames > 0
      ? exitStyle(next!.transition.type, (local - (scene.frames - outFrames)) / outFrames)
      : {};
  // A slow push-in keeps every frame alive, even while a scene holds still.
  const push =
    1 +
    0.035 * interpolate(local, [0, scene.frames + outFrames], [0, 1], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ ...enter.wrap }}>
      <AbsoluteFill style={{ ...exit }}>
        <AbsoluteFill style={{ transform: `scale(${push})` }}>
          <SceneContext.Provider value={{ lead, frames: scene.frames }}>
            {Kind ? <Kind {...scene.props} /> : null}
          </SceneContext.Provider>
        </AbsoluteFill>
      </AbsoluteFill>
      {enter.overlay}
    </AbsoluteFill>
  );
}

function Progress({ color }: { color: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        height: Math.max(6, width * 0.006),
        width: `${(100 * frame) / Math.max(1, durationInFrames - 1)}%`,
        background: color,
        boxShadow: `0 0 18px ${color}`,
      }}
    />
  );
}

export const Film: React.FC<{ film: FilmData }> = ({ film }) => {
  const fontFaces = (film.fonts ?? [])
    .map((f) => `@font-face{font-family:'${f.family}';src:url('${f.src}');font-display:block}`)
    .join("");
  return (
    <FilmContext.Provider value={film}>
      <AbsoluteFill
        lang={film.lang}
        dir={film.dir}
        style={{
          background: film.theme.bg,
          color: film.theme.fg,
          fontFamily: `'${film.theme.font}', Inter, system-ui, sans-serif`,
          overflow: "hidden",
        }}
      >
        {fontFaces ? <style>{fontFaces}</style> : null}
        <Background />
        {film.scenes.map((s, i) => {
          const lead = s.transition.frames;
          const next = film.scenes[i + 1];
          return (
            <Sequence
              key={s.id}
              from={s.from - lead}
              durationInFrames={s.frames + lead}
              name={`${s.id} (${s.kind})`}
            >
              <SceneLayer scene={s} next={next} lead={lead} />
            </Sequence>
          );
        })}
        {film.scenes.map((s) =>
          s.transition.type === "slash" || s.transition.type === "shatter" ? (
            <Sequence key={`f-${s.id}`} from={s.from - 2} durationInFrames={8} layout="none">
              <Flash />
            </Sequence>
          ) : null,
        )}
        {film.style.captions !== "none" ? <Captions pages={film.captions} /> : null}
        {film.style.grain ? <Grain /> : null}
        {film.style.progress ? <Progress color={film.theme.accent} /> : null}
      </AbsoluteFill>
    </FilmContext.Provider>
  );
};
