#!/usr/bin/env node
// Turns the timeline section of a postmortem (markdown) into a draft incident-replay project: video.json,
// script.md and facts.md. Times are used exactly as written; the only numbers computed are the minutes between
// them. Events without a time are refused, never guessed. Text only: nothing is run or fetched.
// Event line:  - 14:02 [action] Deploy 2.3 rolled out | api      (type and "| where" are optional)
// Usage: node incident.mjs --postmortem postmortem.md --out projects/<slug> [--title "Checkout outage"] [--format short-9x16]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const MAX_BYTES = 1024 * 1024;
const FORMATS = ["reel-9x16", "short-9x16", "youtube-16x9", "square-1x1"];
const TYPES = ["failure", "alert", "action", "fix", "info"];
const UNSAFE = new RegExp("[\\p{Cc}\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "gu");
const clean = (t, max) =>
  String(t ?? "")
    .replace(UNSAFE, " ")
    .replace(/[`*_]/g, "")
    .trim()
    .slice(0, max);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const EVENT =
  /^\s*(?:[-*]\s+|\d+\.\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(UTC|Z|[A-Z]{3,4})?\s*(?:[-–—:]\s*)?(?:\[(\w+)\]\s*)?(.+)$/;

/** Events from the section whose heading contains "timeline" (else the whole text). Pure. */
export function parseTimeline(text) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const head = lines.findIndex((l) => /^#{1,4}\s.*timeline/i.test(l));
  const body = [];
  for (const l of head < 0 ? lines : lines.slice(head + 1)) {
    if (head >= 0 && /^#{1,4}\s/.test(l)) break;
    body.push(l);
  }
  const events = [];
  const problems = [];
  for (const l of body) {
    if (!/^\s*(?:[-*]\s+|\d+\.\s+)?\d{1,2}:\d{2}/.test(l)) {
      if (/^\s*[-*]\s+\S/.test(l) && head >= 0)
        problems.push(`No time at the start of: "${clean(l, 40)}"`);
      continue;
    }
    const m = EVENT.exec(l);
    const [h, min, sec = "0"] = [m[1], m[2], m[3]];
    if (Number(h) > 23 || Number(min) > 59 || Number(sec) > 59) {
      problems.push(`Not a valid time: "${clean(l, 40)}"`);
      continue;
    }
    const type = m[5]?.toLowerCase();
    if (type && !TYPES.includes(type)) {
      problems.push(`Unknown type [${type}] (use ${TYPES.join(", ")})`);
      continue;
    }
    const [label, where] = m[6].split("|").map((x) => x.trim());
    events.push({
      secs: Number(h) * 3600 + Number(min) * 60 + Number(sec),
      at: `${h.padStart(2, "0")}:${min}${m[4] ? ` ${m[4]}` : ""}`,
      label: clean(label, 60),
      ...(where ? { where: clean(where, 24) } : {}),
      type: type ?? "info",
    });
  }
  events.forEach((e, i) => {
    if (i && e.secs < events[i - 1].secs)
      problems.push(
        `The time ${e.at} comes before ${events[i - 1].at}; the timeline must go forward (add the date or reorder).`,
      );
  });
  return { events, problems };
}

const minutes = (a, b) => Math.round((b - a) / 60);

/** The project files for an incident replay. Pure. */
export function buildIncident(events, { title, format = "short-9x16" }) {
  const lines = [];
  const facts = [];
  const fact = (text, source) => {
    facts.push({ id: `f${facts.length + 1}`, text, source });
    return `f${facts.length}`;
  };
  const line = (text, beat, factId) => {
    lines.push({ id: `l${lines.length + 1}`, text, beat, fact: factId });
    return `l${lines.length}`;
  };
  const first = events.find((e) => e.type === "failure") ?? events[0];
  const alert = events.find((e) => e.type === "alert" && e.secs >= first.secs);
  const fix = [...events].reverse().find((e) => e.type === "fix");
  const hook = line(`This is the story of ${title}, from the postmortem.`, "hook");
  const evLines = events.map((e, i) => {
    const f = fact(`At ${e.at}: ${e.label}.`, "postmortem timeline");
    return line(`${e.at}. ${e.label}.`, i === 0 ? "setup" : "step", f);
  });
  const scenes = [
    {
      id: "s1",
      kind: "title",
      props: { text: title, subtitle: "an incident replay" },
      narration: [hook],
    },
    {
      id: "s2",
      kind: "timeline",
      props: {
        title: "What happened",
        events: events.map((e) => ({
          at: e.at,
          label: e.label,
          type: e.type,
          ...(e.where ? { where: e.where } : {}),
        })),
      },
      narration: evLines,
    },
  ];
  const out = [];
  if (alert && alert.secs > first.secs)
    out.push(
      `It took ${plural(minutes(first.secs, alert.secs), "minute", "minutes")} from the first failure to the alert.`,
    );
  if (fix && fix.secs > first.secs)
    out.push(
      `It took ${plural(minutes(first.secs, fix.secs), "minute", "minutes")} from the first failure to the fix.`,
    );
  const outLines = out.map((t) => line(t, "lesson", fact(t, "computed from the postmortem times")));
  scenes.push({
    id: "s3",
    kind: "list",
    props: {
      heading: "By the clock",
      items: out.length ? out : [`${plural(events.length, "event", "events")} in the timeline`],
    },
    narration: outLines.length
      ? outLines
      : [line(`The timeline has ${plural(events.length, "event", "events")}.`, "lesson")],
  });
  const video = {
    version: 1,
    meta: {
      title,
      type: "explainer",
      format,
      fps: 30,
      lang: "en",
      audience: "the team and people who depend on this service",
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
    summary: { events: events.length, computed: out.length },
  };
}

function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), {
      strings: ["postmortem", "out", "title", "format"],
    });
    if (!flags.postmortem || !flags.out)
      throw new Error("Give --postmortem postmortem.md and --out projects/<slug>");
    if (statSync(flags.postmortem).size > MAX_BYTES)
      throw new Error("The postmortem is larger than 1 MB; refusing to read it.");
    const format = flags.format ?? "short-9x16";
    if (!FORMATS.includes(format)) throw new Error(`--format is one of ${FORMATS.join(", ")}.`);
    const { events, problems } = parseTimeline(readFileSync(flags.postmortem, "utf8"));
    if (problems.length)
      throw new Error(`Fix the postmortem first:\n${problems.slice(0, 8).join("\n")}`);
    if (events.length < 2 || events.length > 10)
      throw new Error(
        `Found ${events.length} timed events; a replay needs 2 to 10. Merge or trim lines in the timeline section.`,
      );
    if (existsSync(path.join(flags.out, "video.json")))
      throw new Error(
        `${flags.out}/video.json exists; choose a new folder so nothing is overwritten.`,
      );
    const r = buildIncident(events, { title: clean(flags.title ?? "The incident", 60), format });
    mkdirSync(flags.out, { recursive: true });
    writeFileSync(path.join(flags.out, "video.json"), `${JSON.stringify(r.video, null, 2)}\n`);
    writeFileSync(path.join(flags.out, "script.md"), r.script);
    writeFileSync(path.join(flags.out, "facts.md"), r.facts);
    console.log(
      capLines(
        [
          `Wrote ${flags.out}: ${plural(r.summary.events, "event", "events")}, ${plural(r.summary.computed, "computed duration", "computed durations")}.`,
        ],
        "Draft narration is mechanical: reword it with video-write, keep every fact id.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
