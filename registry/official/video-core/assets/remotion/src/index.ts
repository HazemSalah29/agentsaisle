// Entry point for `remotion render`. render.mjs copies this folder into the engine install and passes the film as
// --props, so the same source renders every project.
import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
