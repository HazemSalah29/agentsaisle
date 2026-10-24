"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";

export interface FadeUpProps extends ComponentPropsWithoutRef<"div"> {
  /** Fade in as soon as the page loads (pure CSS). Use for the first screen. Default: wait until scrolled into view. */
  immediate?: boolean;
  /** Milliseconds to wait. Use sparingly, for a staggered row. */
  delay?: number;
}

/**
 * The kit's one enter animation: a 300 ms fade up. Content stays visible with reduced motion and
 * without JavaScript (see the rules at the bottom of tokens.css).
 */
export function FadeUp({ immediate = false, delay = 0, style, ...rest }: FadeUpProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (immediate || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate]);

  const delayStyle = delay
    ? { ...style, transitionDelay: `${delay}ms`, animationDelay: `${delay}ms` }
    : style;
  return immediate ? (
    <div data-fade-load="" style={delayStyle} {...rest} />
  ) : (
    <div ref={ref} data-fade="" data-shown={shown} style={delayStyle} {...rest} />
  );
}
