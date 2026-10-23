// Placeholder content for the demo. Lowtide Studio is fictional; every name, client and number here is made up.
import type { Post, Project, Service } from "./components/kit";

const img = (name: string, alt: string) => ({
  src: `/art/${name}.svg`,
  alt,
  width: 1200,
  height: 900,
});

export const NAV = [
  { label: "Work", href: "/work" },
  { label: "About", href: "/about" },
  { label: "Journal", href: "/blog" },
  { label: "Contact", href: "/contact" },
] as const;

export const SOCIALS = [
  { label: "Instagram", href: "#" },
  { label: "Vimeo", href: "#" },
  { label: "LinkedIn", href: "#" },
] as const;

export interface CaseStudy extends Project {
  slug: string;
  summary: string;
  role: string;
  body: readonly string[];
}

export const PROJECTS: readonly CaseStudy[] = [
  {
    slug: "harbour-bank",
    title: "Harbour Bank",
    client: "Harbour",
    year: "2026",
    category: "Product motion",
    href: "/work/harbour-bank",
    image: img("plate-tide", "Violet arcs rising from a dark horizon."),
    summary: "A banking app that explains a transfer with movement instead of a progress bar.",
    role: "Motion system, prototypes, front-end",
    body: [
      "Harbour's customers did not trust the moment between pressing Send and seeing Done. We replaced the spinner with a small sequence that shows the money leaving, travelling and landing.",
      "Every transition shares one easing curve and four durations, so the app feels like one hand made it. Reduced-motion users get the same states as still frames with clear text.",
    ],
  },
  {
    slug: "paper-planes",
    title: "Paper Planes",
    client: "Paper Planes Records",
    year: "2025",
    category: "Brand and web",
    href: "/work/paper-planes",
    image: img("plate-bars", "Diagonal bars, one in violet."),
    summary: "An independent label's site where each release has its own rhythm of type.",
    role: "Identity, web design, build",
    body: [
      "The label releases few records and wanted each page to feel like a sleeve. Headlines change width from release to release, and the grid stays the same underneath.",
      "The whole site ships under 150 kB of JavaScript per page, so it opens quickly on a festival connection.",
    ],
  },
  {
    slug: "field-notes",
    title: "Field Notes",
    client: "Meridian Lab",
    year: "2025",
    category: "Data story",
    href: "/work/field-notes",
    image: img("plate-dots", "A field of dots that swell toward the centre."),
    summary: "A scrolling essay on coastal erosion where the dots are the data.",
    role: "Art direction, interaction, build",
    body: [
      "Forty years of survey points became a field of dots that change size as you scroll through the decades. The reader controls time with their scroll wheel.",
      "Each chart has a plain table behind it, so nothing depends on seeing the animation.",
    ],
  },
  {
    slug: "north-orbit",
    title: "North Orbit",
    client: "North Orbit Space",
    year: "2024",
    category: "Launch site",
    href: "/work/north-orbit",
    image: img("plate-orbit", "A large ring with a single violet dot orbiting it."),
    summary: "A launch-day site for a small satellite company, built in three weeks.",
    role: "Design, motion, build",
    body: [
      "The brief was one page that had to survive a traffic spike. We kept it static, animated only transform and opacity, and let a single orbiting dot carry the story.",
      "The page scored in the high nineties for performance on a mid-range phone.",
    ],
  },
];

export const POSTS: readonly Post[] = [
  {
    title: "Four durations are enough",
    excerpt:
      "Why our motion system has exactly four timings, and what we do when a designer asks for a fifth.",
    date: "12 March 2026",
    category: "Craft",
    href: "/blog",
    image: img("plate-waves", "Layered waves in violet and off-white."),
  },
  {
    title: "Designing for reduced motion first",
    excerpt: "Start from the still version. Add movement only where it explains something.",
    date: "2 February 2026",
    category: "Accessibility",
    href: "/blog",
    image: img("plate-grid", "A grid of squares, a few filled with violet."),
  },
  {
    title: "What a spinner says",
    excerpt: "A waiting animation is a promise. Notes from a year of rebuilding loading states.",
    date: "18 December 2025",
    category: "Product",
    href: "/blog",
    image: img("plate-tide", "Violet arcs rising from a dark horizon."),
  },
];

export const SERVICES: readonly Service[] = [
  {
    title: "Motion systems",
    description: "Timings, curves and rules your whole team can reuse, with code to match.",
    image: { src: "/art/plate-waves.svg", alt: "" },
  },
  {
    title: "Brand websites",
    description: "Fast, accessible sites where type and movement carry the identity.",
    image: { src: "/art/plate-bars.svg", alt: "" },
  },
  {
    title: "Product prototypes",
    description: "Working prototypes that show how an interface should feel before it is built.",
    image: { src: "/art/plate-grid.svg", alt: "" },
  },
  {
    title: "Launch pages",
    description: "One page, one story, built to hold up when everyone arrives at once.",
    image: { src: "/art/plate-orbit.svg", alt: "" },
  },
];

export const STATS = [
  { value: 42, suffix: "", label: "sites shipped" },
  { value: 97, suffix: "", label: "typical Lighthouse score" },
  { value: 9, suffix: "", label: "years in motion" },
  { value: 2, suffix: "", label: "people, no account managers" },
] as const;

export const CLIENT_WORDS = [
  "Harbour",
  "Paper Planes",
  "Meridian Lab",
  "North Orbit",
  "Tidewater",
  "Kiln & Co.",
] as const;
