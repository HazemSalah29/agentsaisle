"use client";

import { AnimatePresence, m, useMotionValue, useSpring } from "motion/react";
import { useState, type PointerEvent } from "react";
import { duration, ease } from "./tokens";
import { useMotionOk } from "./use-motion-ok";

export interface Service {
  title: string;
  description: string;
  /** Shown in a floating card that follows the pointer while this row is hovered. */
  image?: { src: string; alt: string };
}

export interface ServiceListProps {
  services: readonly Service[];
}

/** Large numbered rows. On a mouse, hovering a row floats its image beside the pointer. */
export function ServiceList({ services }: ServiceListProps) {
  const motionOk = useMotionOk();
  const [active, setActive] = useState<number | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 28, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 260, damping: 28, mass: 0.5 });
  const image = active === null ? undefined : services[active]?.image;

  function track(e: PointerEvent) {
    if (e.pointerType !== "mouse") return;
    x.set(e.clientX);
    y.set(e.clientY);
  }

  return (
    <div onPointerMove={track} onPointerLeave={() => setActive(null)}>
      <ol className="border-t border-line">
        {services.map((s, i) => (
          <li key={s.title} className="border-b border-line">
            <div
              className="grid items-baseline gap-4 py-8 md:grid-cols-12 md:py-10"
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
            >
              <span className="font-display text-lead text-muted tabular-nums md:col-span-1">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3
                className={`font-display text-title uppercase transition-colors md:col-span-6 ${
                  active === i ? "text-accent" : "text-ink"
                }`}
              >
                {s.title}
              </h3>
              <p className="text-lead max-w-[40ch] text-muted md:col-span-5">{s.description}</p>
            </div>
          </li>
        ))}
      </ol>
      {motionOk ? (
        <AnimatePresence>
          {image ? (
            <m.img
              key={image.src}
              data-kit-curtain
              src={image.src}
              alt=""
              aria-hidden="true"
              width={320}
              height={240}
              className="pointer-events-none fixed top-0 left-0 z-30 ml-4 -mt-15 h-30 w-40 object-cover"
              style={{ x: sx, y: sy }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: duration.fast, ease: ease.outExpo }}
            />
          ) : null}
        </AnimatePresence>
      ) : null}
    </div>
  );
}
