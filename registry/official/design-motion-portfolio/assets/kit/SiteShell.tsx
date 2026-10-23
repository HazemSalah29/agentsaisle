"use client";

import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";
import { useMotionOk } from "./use-motion-ok";

/**
 * Wrap the whole app once (in the root layout). Turns on inertial smooth scroll, unless the
 * visitor asked for reduced motion or uses a touch screen, where native scroll is better.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  const motionOk = useMotionOk();

  useEffect(() => {
    if (!motionOk) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    // autoRaf drives the animation loop itself; destroy() stops it and removes listeners.
    const lenis = new Lenis({ autoRaf: true, duration: 1.2, respectReducedMotion: true });
    return () => lenis.destroy();
  }, [motionOk]);

  return (
    <>
      {/* Without JavaScript nothing can reveal, so show everything. */}
      <noscript>
        <style>{"[data-kit-motion]{transform:none!important;opacity:1!important}"}</style>
      </noscript>
      {children}
    </>
  );
}
