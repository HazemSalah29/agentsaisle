"use client";

import { m, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useMotionOk } from "./use-motion-ok";

export interface Project {
  title: string;
  client: string;
  year: string;
  category: string;
  href: string;
  image: { src: string; alt: string; width: number; height: number };
}

export interface ProjectCardProps {
  project: Project;
  className?: string;
}

/** A project link. The image drifts slightly inside its frame as the card scrolls past. */
export function ProjectCard({ project, className = "" }: ProjectCardProps) {
  const motionOk = useMotionOk();
  const frame = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: frame, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-7%", "7%"]);
  const { image } = project;

  return (
    <a href={project.href} className={`group block ${className}`.trim()}>
      <div ref={frame} className="relative overflow-hidden bg-raised">
        <m.div
          data-kit-motion
          className="scale-[1.18] will-change-transform"
          style={motionOk ? { y } : undefined}
        >
          <img
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            loading="lazy"
            className="block h-auto w-full"
          />
        </m.div>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <h3 className="font-display text-lead text-ink uppercase transition-colors group-hover:text-accent">
          {project.title}
        </h3>
        <p className="text-sm text-muted">
          {project.client} / {project.year} / {project.category}
        </p>
      </div>
    </a>
  );
}
