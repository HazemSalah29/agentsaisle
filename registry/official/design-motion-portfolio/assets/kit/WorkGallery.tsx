"use client";

import { m, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ProjectCard, type Project } from "./ProjectCard";
import { useMotionOk } from "./use-motion-ok";

export interface WorkGalleryProps {
  projects: readonly Project[];
}

/** The pinned version. It is its own component so the scroll tracking starts with the ref attached. */
function Pinned({ projects }: WorkGalleryProps) {
  const section = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  // Slide until the last card reaches the right edge: (n - 1) cards out of n columns.
  const shift = `-${((projects.length - 1) / projects.length) * 100}%`;
  const x = useTransform(scrollYProgress, [0, 1], ["0%", shift]);

  return (
    <div ref={section} style={{ height: `${projects.length * 70}vh` }}>
      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        <m.div
          className="flex gap-12 pl-gutter will-change-transform"
          style={{ x, width: `${projects.length * 45}vw` }}
        >
          {projects.map((p) => (
            <ProjectCard key={p.href} project={p} className="w-[42vw] shrink-0" />
          ))}
        </m.div>
      </div>
    </div>
  );
}

/**
 * Projects in a row that scrolls sideways while the page scrolls down (the section pins).
 * On a phone, or with reduced motion, it is a plain stack of cards.
 */
export function WorkGallery({ projects }: WorkGalleryProps) {
  const motionOk = useMotionOk();
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (wide && motionOk) return <Pinned projects={projects} />;

  return (
    <div className="grid gap-12 px-gutter md:grid-cols-2">
      {projects.map((p) => (
        <ProjectCard key={p.href} project={p} />
      ))}
    </div>
  );
}
