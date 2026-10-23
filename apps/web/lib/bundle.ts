import type { Question } from "@agentsaisle/registry-schema";

/** Chosen option index per question id. Missing means not answered yet. */
export type Answers = Record<string, number | undefined>;

/**
 * The bundle for the current answers: the union of every chosen option's skills, in the order they
 * first appear across the questions. Skills that aren't in `available` are dropped, so a stale
 * question can never produce an install command that fails.
 */
export function buildBundle(
  questions: Question[],
  answers: Answers,
  available: Iterable<string>,
): string[] {
  const known = new Set(available);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of questions) {
    const choice = answers[q.id];
    if (choice === undefined) continue;
    for (const skill of q.options[choice]?.adds ?? []) {
      if (known.has(skill) && !seen.has(skill)) {
        seen.add(skill);
        out.push(skill);
      }
    }
  }
  return out;
}
