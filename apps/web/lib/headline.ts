/** Splits "Say what you want. Get it made." into the plain lines and the italic last sentence. Pure. */
export function splitHeadline(text: string): { lines: string[]; accent: string } {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 2) return { lines: sentences, accent: "" };
  return { lines: sentences.slice(0, -1), accent: sentences[sentences.length - 1]! };
}

/** The first sentence of a longer description, cut at a word if it is still very long. Pure. */
export function firstSentence(text: string, max = 170): string {
  const first = text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  if (first.length <= max) return first;
  const cut = first.slice(0, max).replace(/\s+\S*$/, "");
  return `${cut}…`;
}
