import type { ReactNode } from "react";

export interface MarqueeProps {
  /** What scrolls past. It is repeated to fill the loop, so keep it to one row's worth. */
  children: ReactNode;
  /** Time for one full loop. */
  speed?: "slow" | "base" | "fast";
  direction?: "left" | "right";
  /** Pause while the pointer is over it. Default true. */
  pauseOnHover?: boolean;
  className?: string;
}

/** An endless row. Pure CSS, so it costs no JavaScript. Stops moving for reduced motion. */
export function Marquee({
  children,
  speed = "base",
  direction = "left",
  pauseOnHover = true,
  className = "",
}: MarqueeProps) {
  const track = {
    animation: `kit-marquee var(--marquee-${speed}) linear infinite`,
    animationDirection: direction === "left" ? "normal" : "reverse",
  } as const;
  return (
    <div className={`group flex overflow-hidden ${className}`.trim()}>
      <div
        data-kit-motion
        className={`flex min-w-max shrink-0 ${pauseOnHover ? "group-hover:[animation-play-state:paused]" : ""}`.trim()}
        style={track}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
