// The film as resolve.mjs writes it. Times inside scene props are seconds from the scene's start.

export type Theme = {
  preset: string;
  bg: string;
  fg: string;
  accent: string;
  accent2: string;
  muted: string;
  danger: string;
  ok: string;
  font: string;
};

export type TransitionType =
  "cut" | "fade" | "slide" | "whip" | "zoom-through" | "slash" | "shatter";

export type SceneData = {
  id: string;
  kind: string;
  from: number;
  frames: number;
  transition: { type: TransitionType; frames: number };
  // Each kind reads its own props; resolve.mjs guarantees their shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any;
};

export type CaptionWord = { text: string; start: number; end: number };
export type CaptionPage = { start: number; end: number; words: CaptionWord[] };

export type Film = {
  width: number;
  height: number;
  fps: number;
  frames: number;
  lang: string;
  dir: "ltr" | "rtl";
  theme: Theme;
  style: {
    captions: "pop" | "karaoke" | "clean" | "none";
    progress: boolean;
    grain: boolean;
    background: string;
  };
  captions: CaptionPage[];
  fonts?: { family: string; src: string }[];
  scenes: SceneData[];
};
