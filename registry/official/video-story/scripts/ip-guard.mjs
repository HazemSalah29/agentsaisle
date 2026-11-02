// Refuses prompts that name a known copyrighted character, a brand or logo, or ask for a real person's likeness.
// A small guard, not a filter that can know everything: the skill also tells the agent to refuse lookalikes by judgement.
import { KNOWN } from "./_bible-check.mjs";

// Names in the shared list that are also ordinary words; matching them would block "a chase scene".
const COMMON = new Set(["chase", "arthur", "anna", "dora", "gru", "patrick star"]);
const BRANDS = [
  "nike",
  "adidas",
  "coca-cola",
  "coca cola",
  "pepsi",
  "apple logo",
  "starbucks",
  "disney",
  "pixar",
  "marvel",
  "netflix",
  "mcdonald",
  "lego",
  "ferrari",
  "gucci",
  "louis vuitton",
];
const LIKENESS = [
  /\b(looks?|looking|resembl\w*|lookalike|likeness|face of|photo of|portrait of)\b[^.]{0,40}\b(president|celebrity|actor|actress|singer|politician|footballer|streamer)\b/i,
  /\b(real|actual) (person|people|celebrity)\b/i,
  /\bdeepfake\b/i,
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NAMES = [...KNOWN.filter((k) => !COMMON.has(k)), ...BRANDS];
const NAME_RE = new RegExp(`(?<![a-z0-9])(${NAMES.map(esc).join("|")})(?![a-z0-9])`, "i");

/** A refusal sentence for a prompt, or null when nothing in it is on the guard's lists. */
export function ipRefusal(text) {
  const hit = NAME_RE.exec(text);
  if (hit)
    return `Refused: "${hit[1]}" is a copyrighted or trademarked name. Describe an original character or brand instead (shape, colours, outfit), not a known one.`;
  if (LIKENESS.some((r) => r.test(text)))
    return "Refused: prompts may not ask for a real person's likeness. Describe an original character instead.";
  return null;
}
