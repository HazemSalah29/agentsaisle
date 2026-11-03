// Fonts come from npm (@fontsource, SIL OFL) and are bundled into the render: nothing is fetched while rendering.
// Remotion waits for document.fonts before it captures a frame (see Grain/Captions: they wait too).
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/anton/400.css";
import { continueRender, delayRender } from "remotion";

export const MONO = "'JetBrains Mono', ui-monospace, monospace";
export const DISPLAY = "Anton, Impact, 'Arial Narrow', sans-serif";

if (typeof document !== "undefined") {
  const handle = delayRender("fonts");
  const wanted = [
    "500 20px Inter",
    "700 20px Inter",
    "800 20px Inter",
    "900 20px Inter",
    "500 20px 'JetBrains Mono'",
    "700 20px 'JetBrains Mono'",
    "400 20px Anton",
  ];
  Promise.all(wanted.map((f) => document.fonts.load(f)))
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
}
