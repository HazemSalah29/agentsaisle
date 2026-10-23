import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { rulesFile } from "./agents.js";
import type { Context } from "./context.js";
import { CliError } from "./errors.js";

export const RULES_START = "<!-- agent-aisle:start -->";
export const RULES_END = "<!-- agent-aisle:end -->";

export type RulesAction = "created" | "appended" | "replaced" | "unchanged";

const count = (text: string, needle: string) => text.split(needle).length - 1;

/**
 * Put the rules block into a file's text. Replaces an existing block in place, otherwise appends
 * (or creates, when `existing` is undefined). Everything outside the markers stays byte-identical,
 * and a CRLF file keeps CRLF. A damaged file is refused rather than guessed at.
 */
export function applyRulesBlock(
  existing: string | undefined,
  rules: string,
): { text: string; action: RulesAction } {
  const crlf =
    existing !== undefined &&
    count(existing, "\r\n") > count(existing, "\n") - count(existing, "\r\n");
  const eol = crlf ? "\r\n" : "\n";
  const block = [RULES_START, ...rules.trim().split(/\r?\n/), RULES_END].join(eol);

  if (existing === undefined) return { text: block + eol, action: "created" };

  const starts = count(existing, RULES_START);
  const ends = count(existing, RULES_END);
  if (starts === 0 && ends === 0) {
    if (existing === "") return { text: block + eol, action: "appended" };
    const gap = existing.endsWith("\n") ? eol : eol + eol;
    return { text: existing + gap + block + eol, action: "appended" };
  }
  if (starts > 1 || ends > 1) {
    throw new CliError(
      "Found more than one Agent Aisle rules block. Remove the extras and run again.",
    );
  }
  if (starts !== ends) {
    throw new CliError(
      `Found a ${starts ? "start" : "end"} marker without a matching ${starts ? "end" : "start"} marker. Fix or remove it and run again.`,
    );
  }
  const from = existing.indexOf(RULES_START);
  const to = existing.indexOf(RULES_END);
  if (to < from)
    throw new CliError(
      "The Agent Aisle rules markers are in the wrong order. Fix them and run again.",
    );

  const end = to + RULES_END.length;
  if (existing.slice(from, end) === block) return { text: existing, action: "unchanged" };
  return { text: existing.slice(0, from) + block + existing.slice(end), action: "replaced" };
}

/** Write the house rules block into CLAUDE.md or AGENTS.md. Respects --dry-run and asks first. */
export async function installRules(rules: string, ctx: Context): Promise<void> {
  const file = rulesFile({ agent: ctx.agent, global: ctx.global, cwd: ctx.cwd });
  let current: string | undefined;
  try {
    current = await readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  // Computed before any prompt or write, so a damaged file fails without touching anything.
  const { text, action } = applyRulesBlock(current, rules);
  if (action === "unchanged") {
    ctx.log(`House rules in ${file} are already up to date.`);
    return;
  }

  const verb = {
    created: "create",
    appended: "add the rules block to",
    replaced: "update the rules block in",
  }[action];
  if (ctx.dryRun) {
    ctx.log(`[dry-run] would ${verb} ${file}`);
    return;
  }
  if (!(await ctx.confirm(`${verb[0]!.toUpperCase()}${verb.slice(1)} ${file}?`))) {
    ctx.log("Skipped the house rules.");
    return;
  }
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, text);
  await rename(tmp, file);
  ctx.log(
    `Wrote house rules to ${file} (${action === "replaced" ? "updated the block" : "added the block"}).`,
  );
}
