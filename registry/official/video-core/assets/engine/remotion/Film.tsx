/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Draws the whole film from film.json: the same markup, stylesheet and animation plan the HyperFrames engine
// uses. Every animation is paused and placed on the clock, so frame N always shows time N / fps.
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import film from "./film.json";
import "./tween.js";
import { applyFrame, seekVideo } from "./runtime.js";

// Files copied into public/ are named relative to it; staticFile gives the URL the renderer serves them at.
const css = film.css.replace(/url\('(assets\/[^']+)'\)/g, (_, p) => `url('${staticFile(p)}')`);

export const Film = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef(null);
  const setup = useRef(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => ({ __html: film.body }), []);
  if (setup.current === null) setup.current = delayRender("film setup");

  useLayoutEffect(() => {
    let dead = false;
    (async () => {
      for (const el of ref.current.querySelectorAll("[src^='assets/']"))
        el.setAttribute("src", staticFile(el.getAttribute("src")));
      const tl = window.VT.run(film.plan, { id: "main", duration: film.seconds });
      if (film.gls.length) {
        const mod = await import(
          /* webpackIgnore: true */ staticFile("assets/3d/puppet3d-page.mjs")
        );
        mod.mount(tl, film.gls);
      }
      await document.fonts.ready;
      if (!dead) setReady(true);
    })().catch((e) => cancelRender(e));
    return () => {
      dead = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    const t = frame / fps;
    window.__timelines.main.time(t);
    const handle = delayRender(`frame ${frame}`);
    Promise.all(applyFrame(ref.current, t).map((v) => seekVideo(v.el, v.time)))
      .then(() => {
        continueRender(handle);
        if (setup.current !== null) {
          continueRender(setup.current);
          setup.current = null;
        }
      })
      .catch((e) => cancelRender(e));
  }, [ready, frame, fps]);

  return (
    <>
      <style>{css}</style>
      <div id="film" ref={ref} dir={film.dir} lang={film.lang} dangerouslySetInnerHTML={html} />
    </>
  );
};
