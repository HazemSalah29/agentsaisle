"use client";

import type Lenis from "lenis";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { duration, ease } from "./tokens";
import { useMotionOk } from "./use-motion-ok";
import { LazyMotion, m, useMotionValue, useSpring } from "motion/react";

// Animation features load in a separate chunk after first paint.
const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

const LenisContext = createContext<Lenis | null>(null);

/** The smooth-scroll instance, or null when smooth scroll is off (touch, reduced motion). */
export function useLenis(): Lenis | null {
  return useContext(LenisContext);
}

/** Scroll to the top, smoothly when allowed. */
export function scrollToTop(lenis: Lenis | null, smooth: boolean) {
  if (lenis) lenis.scrollTo(0, { duration: duration.epic });
  else window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
}

function Cursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.3 });
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.3 });
  const [big, setBig] = useState(false);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setBig(!!(e.target as HTMLElement | null)?.closest?.("a, button, [data-cursor]"));
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);

  return (
    <m.div
      aria-hidden="true"
      data-kit-curtain
      className="pointer-events-none fixed top-0 left-0 z-50 -ml-1 -mt-1 h-2 w-2 rounded-full bg-accent mix-blend-difference"
      style={{ x: sx, y: sy }}
      animate={{ scale: big ? 3 : 1 }}
      transition={{ duration: duration.fast, ease: ease.outExpo }}
    />
  );
}

export interface SiteShellProps {
  children: ReactNode;
  /** Show a small cursor dot that grows over links and buttons. Mouse only; off on touch. */
  cursor?: boolean;
}

/**
 * Wrap the whole app once (in the root layout). Turns on inertial smooth scroll, unless the
 * visitor asked for reduced motion or uses a touch screen, where native scroll is better.
 */
export function SiteShell({ children, cursor = false }: SiteShellProps) {
  const motionOk = useMotionOk();
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const [fine, setFine] = useState(false);

  useEffect(() => {
    const isFine = window.matchMedia("(pointer: fine)").matches;
    setFine(isFine);
    if (!motionOk || !isFine) return;
    // Load Lenis after first paint so it is not part of the first-load JavaScript.
    // autoRaf drives the animation loop itself; destroy() stops it and removes listeners.
    let instance: Lenis | null = null;
    let cancelled = false;
    import("lenis").then(({ default: LenisClass }) => {
      if (cancelled) return;
      instance = new LenisClass({ autoRaf: true, duration: 1.2, respectReducedMotion: true });
      setLenis(instance);
    });
    return () => {
      cancelled = true;
      instance?.destroy();
      setLenis(null);
    };
  }, [motionOk]);

  return (
    <LazyMotion features={loadFeatures} strict>
      <LenisContext.Provider value={lenis}>
        {/* Without JavaScript nothing can reveal, so show everything. */}
        <noscript>
          <style>{"[data-kit-motion]{transform:none!important;opacity:1!important}"}</style>
        </noscript>
        {children}
        {cursor && motionOk && fine ? <Cursor /> : null}
      </LenisContext.Provider>
    </LazyMotion>
  );
}
