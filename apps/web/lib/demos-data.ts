import type { ComingEntry, DemoView } from "./demos";
import index from "../public/video-demos/index.json";

/** The demos found at build time (written by scripts/copy-registry.mts), so no file is read at run time. */
export const getDemos = () => index as unknown as { demos: DemoView[]; coming: ComingEntry[] };
