// Scene kind -> component. Keep in step with KINDS in assets/film/rules.mjs.
import type React from "react";
import { Chart, Code, Terminal } from "./dev";
import { Nodes, RateLimit, RequestFlow, Sequence } from "./diagrams";
import { Kinetic } from "./kinetic";
import { Broll, Screen } from "./media";
import { List, NumberScene, Quote, Steps, Title, Versus } from "./text";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SCENES: Record<string, React.FC<any>> = {
  title: Title,
  quote: Quote,
  list: List,
  number: NumberScene,
  versus: Versus,
  steps: Steps,
  code: Code,
  terminal: Terminal,
  chart: Chart,
  nodes: Nodes,
  "request-flow": RequestFlow,
  "rate-limit": RateLimit,
  sequence: Sequence,
  broll: Broll,
  kinetic: Kinetic,
  screen: Screen,
};
