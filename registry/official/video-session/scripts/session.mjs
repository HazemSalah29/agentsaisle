#!/usr/bin/env node
// Turns a saved agent-session log (Claude Code JSONL or a plain timestamped text log) into a draft "watch an AI
// build this" project: video.json, script.md and facts.md. The log is read as text only and never run. Secrets,
// home paths and e-mail addresses are redacted before anything becomes text; tool output bodies and thinking
// blocks are never used (only whether a tool call failed). Idle gaps are collapsed, and the only numbers shown
// are counts and times taken from the log.
// Usage: node session.mjs --log session.jsonl --out projects/<slug> [--title "Building a todo app"] [--format short-9x16]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const MAX_BYTES = 100 * 1024 * 1024;
const IDLE_MS = 60_000;
const MAX_MOMENTS = 8;
const FORMATS = ["reel-9x16", "short-9x16", "youtube-16x9", "square-1x1"];
// Working defaults, kept in step with video-core/scripts/check.mjs (a test compares them). TODO(verify)
export const SECRET_RES = [
  /sk-(?:ant-)?[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{30,}/g,
  /github_pat_[A-Za-z0-9_]{40,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]{3,}@/gi,
];
const EXTRA_RES = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]"],
  [/\b(?:[A-Z][A-Z0-9_]{2,}(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD))\s*[=:]\s*\S+/g, "[secret]"],
  [/(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/g, "[secret]"],
];
const UNSAFE = new RegExp("[\\p{Cc}\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "gu");
const TEST_CMD =
  /(?<![/\w.-])(vitest|jest|pytest|mocha|playwright|tsc|eslint|test|build|lint|typecheck)(?![/\w.-])/;
const LANG_BY_EXT = {
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".json": "json",
  ".sh": "bash",
  ".py": "python",
};
/** True when a segment of the command starts with a test/build runner (not just mentions the word later). */
const checkName = (cmd) => {
  for (const seg of String(cmd)
    .split("\n")[0]
    .split(/&&|;|\|\|/)) {
    const m = TEST_CMD.exec(seg.trim().split(/\s+/).slice(0, 3).join(" "));
    if (m) return m[1];
  }
  return null;
};
/** At most 60 characters, cut at a word end with an ellipsis. */
const fit = (t) => (t.length <= 60 ? t : `${t.slice(0, 57).replace(/\s+\S*$/, "")}...`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Redacts one string; `counter.n` counts replacements. Pure apart from the counter. */
export function redact(text, counter = { n: 0 }, home = os.homedir()) {
  let s = String(text ?? "");
  const sub = (re, to) => {
    s = s.replace(re, () => {
      counter.n += 1;
      return to;
    });
  };
  for (const re of SECRET_RES) sub(new RegExp(re.source, re.flags), "[secret]");
  for (const [re, to] of EXTRA_RES) sub(new RegExp(re.source, re.flags), to);
  if (home && home.length > 1)
    sub(new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "~");
  sub(/\/(?:Users|home)\/[^/\s]+/g, "~");
  return s.replace(UNSAFE, " ");
}

const clean = (t, max, counter) =>
  redact(t, counter).replace(/[`*]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const baseName = (p) => (typeof p === "string" ? path.basename(p.replace(/\\/g, "/")) : "");
const ts = (v) => {
  const n = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Events from a log. Claude Code JSONL: user/assistant lines with `timestamp` and `message.content`. Anything else is
 * read as lines starting with HH:MM:SS or an ISO date. Unknown line types and missing fields are skipped. Pure.
 */
export function parseSession(text, counter = { n: 0 }) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const events = [];
  const problems = [];
  const cmdById = new Map();
  let json = 0;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    let d = null;
    if (raw.trimStart().startsWith("{")) {
      try {
        d = JSON.parse(raw);
      } catch {
        d = null;
      }
    }
    if (d && typeof d === "object") {
      json += 1;
      if (d.isSidechain === true) continue;
      const t = ts(d.timestamp);
      const content = d.message?.content;
      if (d.type === "user") {
        const blocks = typeof content === "string" ? [{ type: "text", text: content }] : content;
        for (const b of Array.isArray(blocks) ? blocks : []) {
          if (
            b?.type === "text" &&
            typeof b.text === "string" &&
            !b.text.trimStart().startsWith("<")
          )
            events.push({ t, kind: "prompt", text: clean(b.text.split("\n")[0], 80, counter) });
          if (b?.type === "tool_result" && b.is_error === true) {
            const cmd = cmdById.get(b.tool_use_id);
            events.push({ t, kind: "error", text: cmd?.text ?? "A step failed", test: cmd?.test });
          } else if (b?.type === "tool_result" && cmdById.has(b.tool_use_id)) {
            events.push({
              t,
              kind: "ok",
              text: cmdById.get(b.tool_use_id).text,
              test: cmdById.get(b.tool_use_id).test,
            });
          }
        }
      } else if (d.type === "assistant" && Array.isArray(content)) {
        for (const b of content) {
          if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
            events.push({
              t,
              kind: "say",
              text: clean(b.text.split(/(?<=[.!?])\s/)[0], 80, counter),
            });
          } else if (b?.type === "tool_use") {
            const inp = b.input ?? {};
            if (b.name === "Write")
              events.push({ t, kind: "create", file: clean(baseName(inp.file_path), 24, counter) });
            else if (b.name === "Edit" || b.name === "MultiEdit")
              events.push({
                t,
                kind: "edit",
                file: clean(baseName(inp.file_path), 24, counter),
                before: typeof inp.old_string === "string" ? redact(inp.old_string, counter) : "",
                after: typeof inp.new_string === "string" ? redact(inp.new_string, counter) : "",
              });
            else if (b.name === "Bash" && typeof inp.command === "string") {
              const c = clean(inp.command.split("\n")[0], 50, counter);
              const name = checkName(inp.command);
              const rec = { text: name ?? c, test: name !== null };
              if (b.id) cmdById.set(b.id, rec);
              events.push({ t, kind: "command", ...rec });
            }
          }
        }
      }
      continue;
    }
    // Plain log: "14:02:11 text" or "2026-01-05T14:02:11Z text"; "$ cmd" is a command.
    const m =
      /^\s*(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?|\d{1,2}:\d{2}:\d{2})\s*[-–—:|]?\s*(.+)$/.exec(
        raw,
      );
    if (!m) continue;
    const t = m[1].includes("-")
      ? ts(m[1].replace(" ", "T"))
      : (() => {
          const [h, mi, s] = m[1].split(":").map(Number);
          return ((h * 60 + mi) * 60 + s) * 1000;
        })();
    if (t === null) continue;
    const body = m[2];
    if (/^\$\s+/.test(body)) {
      const c = clean(body.replace(/^\$\s+/, ""), 50, counter);
      const name = checkName(c);
      events.push({ t, kind: "command", text: name ?? c, test: name !== null });
    } else if (/\b(error|failed|fail)\b/i.test(body)) {
      const last = [...events].reverse().find((e) => e.kind === "command");
      events.push({
        t,
        kind: "error",
        text: last?.text ?? clean(body, 50, counter),
        test: last?.test,
      });
    } else if (/\b(passed|success|succeeded|ok)\b/i.test(body)) {
      const last = [...events].reverse().find((e) => e.kind === "command");
      events.push({
        t,
        kind: "ok",
        text: last?.text ?? clean(body, 50, counter),
        test: last?.test,
      });
    } else events.push({ t, kind: "say", text: clean(body, 80, counter) });
  }
  if (!events.length)
    problems.push(
      json
        ? "No user or assistant messages found in the JSONL."
        : "No lines starting with a time (HH:MM:SS) or an ISO date found.",
    );
  if (events.length && events.filter((e) => e.t !== null).length < 2)
    problems.push("Fewer than two timestamps; the log needs times to show elapsed time.");
  events.forEach((e, i) => {
    if (i && e.t !== null && events[i - 1].t !== null && e.t < events[i - 1].t)
      e.t = events[i - 1].t;
  });
  return { events, problems };
}

/** Active seconds elapsed at each event (gaps over 60 s count as 1 s) and the totals. Pure. */
export function activeClock(events) {
  let active = 0;
  let removed = 0;
  let prev = null;
  const at = events.map((e) => {
    if (e.t !== null) {
      if (prev !== null) {
        const gap = e.t - prev;
        if (gap > IDLE_MS) {
          removed += gap - 1000;
          active += 1000;
        } else active += gap;
      }
      prev = e.t;
    }
    return Math.round(active / 1000);
  });
  return { at, active: Math.round(active / 1000), removed: Math.round(removed / 1000) };
}
const mmss = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Up to MAX_MOMENTS key moments in time order, chosen by fixed rules. Pure. */
export function pickMoments(events) {
  const { at } = activeClock(events);
  const cands = [];
  const first = events.findIndex((e) => e.kind === "prompt");
  if (first >= 0)
    cands.push({
      i: first,
      p: 9,
      type: "action",
      label: fit(`Ask: ${events[first].text}`),
      where: "you",
    });
  let group = null;
  const flush = () => {
    if (!group) return;
    const n = group.files.size;
    cands.push({
      i: group.i,
      p: 3,
      type: "action",
      label: n === 1 ? `${group.verb} ${[...group.files][0]}` : `${group.verb} ${n} files`,
      where: "files",
    });
    group = null;
  };
  events.forEach((e, i) => {
    if (e.kind === "create" || e.kind === "edit") {
      const verb = e.kind === "create" ? "Wrote" : "Edited";
      if (group && group.verb !== verb) flush();
      group ??= { i, verb, files: new Set() };
      if (e.file) group.files.add(e.file);
    } else if (e.kind !== "command" && e.kind !== "say") flush();
    else if (e.kind === "command") flush();
  });
  flush();
  const failed = new Set();
  const passed = new Set();
  events.forEach((e, i) => {
    if (e.kind === "error" && e.test) {
      failed.add(e.text);
      cands.push({
        i,
        p: 8,
        type: "failure",
        label: fit(`Failed: ${e.text}`),
        where: "check",
      });
    } else if (e.kind === "ok" && e.test) {
      const fixed = failed.delete(e.text);
      if (!fixed && passed.has(e.text)) return; // a repeated pass says nothing new
      passed.add(e.text);
      cands.push({
        i,
        p: fixed ? 8 : 4,
        type: fixed ? "fix" : "info",
        label: fit(`${fixed ? "Fixed, passes" : "Passes"}: ${e.text}`),
        where: "check",
      });
    }
  });
  let last = -1;
  events.forEach((e, i) => {
    if (e.kind === "say") last = i;
  });
  if (last > first)
    cands.push({
      i: last,
      p: 9,
      type: "info",
      label: fit(`Result: ${events[last].text}`),
      where: "agent",
    });
  const kept = cands
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, MAX_MOMENTS)
    .sort((a, b) => a.i - b.i);
  return kept.map((m) => ({ ...m, at: mmss(at[m.i]), where: m.where }));
}

const bigEdit = (events) => {
  let best = null;
  for (const e of events) {
    if (e.kind !== "edit" || !e.before.trim() || !e.after.trim()) continue;
    const ext = path.extname(e.file ?? "");
    const language = LANG_BY_EXT[ext];
    const ok = (s) =>
      s.length <= 1500 && s.split("\n").length <= 20 && s.split("\n").every((l) => l.length <= 60);
    if (!language || !ok(e.before) || !ok(e.after)) continue;
    const size = e.before.length + e.after.length;
    if (!best || size > best.size) best = { size, e, language };
  }
  return best;
};

/** The project files for a session timelapse. Pure. */
export function buildSession(events, { title, format = "short-9x16" }, redactions = 0) {
  const lines = [];
  const facts = [];
  const stop = (t) => String(t).replace(/[.!?:\s]+$/, "");
  const fact = (text, source) => {
    facts.push({ id: `f${facts.length + 1}`, text, source });
    return `f${facts.length}`;
  };
  const line = (text, beat, factId) => {
    lines.push({ id: `l${lines.length + 1}`, text, beat, fact: factId });
    return `l${lines.length}`;
  };
  const moments = pickMoments(events);
  const clock = activeClock(events);
  const counts = (k) => events.filter((e) => e.kind === k).length;
  const hook = line(`Watch an AI agent work: ${title}.`, "hook");
  const momentLines = moments.map((m, i) => {
    const f = fact(`At ${m.at}: ${stop(m.label)}.`, "session log");
    return line(`${m.at}. ${stop(m.label)}.`, i === 0 ? "setup" : "step", f);
  });
  const scenes = [
    {
      id: "s1",
      kind: "title",
      props: { text: title, subtitle: "an agent session, sped up" },
      narration: [hook],
    },
    {
      id: "s2",
      kind: "timeline",
      props: {
        title: "Key moments",
        events: moments.map((m) => ({ at: m.at, label: m.label, type: m.type, where: m.where })),
      },
      narration: momentLines,
    },
  ];
  const edit = bigEdit(events);
  if (edit) {
    const f = fact(`One edit to ${edit.e.file} during the session.`, "session log");
    scenes.push({
      id: "s3",
      kind: "code",
      props: {
        language: edit.language,
        file: edit.e.file,
        diff: { before: edit.e.before, after: edit.e.after },
      },
      narration: [line(`One of the edits, in ${edit.e.file}.`, "step", f)],
    });
  }
  const stats = [
    `${plural(clock.active ? Math.max(1, Math.round(clock.active / 60)) : 0, "minute", "minutes")} of active work`,
    `${plural(counts("create") + counts("edit"), "file change", "file changes")}`,
    `${plural(counts("command"), "command", "commands")} run`,
  ];
  const sf = fact(
    `${stats.join("; ")}. Idle gaps over 60 seconds counted as one second (${plural(Math.round(clock.removed / 60), "minute", "minutes")} removed).`,
    "counted from the session log",
  );
  scenes.push({
    id: `s${scenes.length + 1}`,
    kind: "list",
    props: { heading: "The session in numbers", items: stats },
    narration: [line(stats.join(", ") + ".", "lesson", sf)],
  });
  const video = {
    version: 1,
    meta: {
      title,
      type: "explainer",
      format,
      fps: 30,
      lang: "en",
      audience: "developers curious how an AI agent builds software",
    },
    script: "script.md",
    scenes,
  };
  const script = `# ${title}\n\n${lines.map((l) => `[${l.id}] ${l.text}\n  beat: ${l.beat}${l.fact ? `\n  fact: ${l.fact}` : ""}\n`).join("\n")}`;
  const factsMd = `# Facts\n\n${facts.map((f) => `- [${f.id}] ${f.text} Source: ${f.source}`).join("\n")}\n`;
  return {
    video,
    script,
    facts: factsMd,
    summary: {
      moments: moments.length,
      active: clock.active,
      removed: clock.removed,
      code: Boolean(edit),
      redactions,
    },
  };
}

function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), {
      strings: ["log", "out", "title", "format"],
    });
    if (!flags.log || !flags.out)
      throw new Error("Give --log session.jsonl and --out projects/<slug>");
    if (statSync(flags.log).size > MAX_BYTES)
      throw new Error(
        "The log is larger than 100 MB; refusing to read it. Cut it to the part you want to show.",
      );
    const format = flags.format ?? "short-9x16";
    if (!FORMATS.includes(format)) throw new Error(`--format is one of ${FORMATS.join(", ")}.`);
    const counter = { n: 0 };
    const { events, problems } = parseSession(readFileSync(flags.log, "utf8"), counter);
    if (problems.length) throw new Error(`Cannot use this log:\n${problems.join("\n")}`);
    if (pickMoments(events).length < 2)
      throw new Error(
        "Found fewer than 2 key moments (a prompt, file changes, checks or a result). The session is too short.",
      );
    if (existsSync(path.join(flags.out, "video.json")))
      throw new Error(
        `${flags.out}/video.json exists; choose a new folder so nothing is overwritten.`,
      );
    const title = clean(flags.title ?? "An AI agent builds an app", 60, counter);
    const r = buildSession(events, { title, format }, counter.n);
    mkdirSync(flags.out, { recursive: true });
    writeFileSync(path.join(flags.out, "video.json"), `${JSON.stringify(r.video, null, 2)}\n`);
    writeFileSync(path.join(flags.out, "script.md"), r.script);
    writeFileSync(path.join(flags.out, "facts.md"), r.facts);
    console.log(
      capLines(
        [
          `Wrote ${flags.out}: ${plural(r.summary.moments, "key moment", "key moments")}${r.summary.code ? ", one code diff" : ""}.`,
          `Active time ${mmss(r.summary.active)}; idle gaps removed ${mmss(r.summary.removed)}.`,
          `Redacted ${plural(r.summary.redactions, "item", "items")} (secrets, e-mails, home paths).`,
        ],
        "Review the captions before publishing: a session shows your prompts and code. Reword with video-write, keep every fact id.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
