#!/usr/bin/env node
// Reads an arch-visualize model (docs/architecture.json) as data and turns one of its flows into the props of a
// `request-flow` scene. Never imports or runs anything from the project the model describes.
// Usage: node arch-import.mjs --model docs/architecture.json --list
//        node arch-import.mjs --model docs/architecture.json --flow <id> [--into video.json --scene <scene-id>]
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { MAX_BYTES, importFlow } from "./_arch-import.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), {
      booleans: ["list"],
      strings: ["model", "flow", "into", "scene"],
    });
    if (!flags.model) throw new Error("Give the model: --model docs/architecture.json");
    if (statSync(flags.model).size > MAX_BYTES)
      throw new Error("The model file is larger than 2 MB; refusing to read it.");
    const model = JSON.parse(readFileSync(flags.model, "utf8"));
    if (flags.list || !flags.flow) {
      const flows = Array.isArray(model.flows) ? model.flows : [];
      const lines = flows.map(
        (f) => `${String(f?.id)}: ${String(f?.name).slice(0, 60)} (${f?.steps?.length ?? 0} steps)`,
      );
      console.log(
        capLines(lines.length ? lines : ["no flows in this model"], "Pick one with --flow <id>."),
      );
      return;
    }
    const props = importFlow(model, flags.flow);
    const lines = [
      `${props.title}: ${props.nodes.length} of ${props.shown.of} components, ${props.steps.length} steps`,
      ...props.steps.map(
        (s, i) =>
          `${i + 1}. ${s.edge ? `${s.reverse ? "<-" : "->"} ${s.edge}` : `event on ${s.node}`}: ${s.label ?? s.event ?? ""}${s.evidence ? `  [${s.evidence}]` : ""}`,
      ),
    ];
    if (flags.into) {
      const video = JSON.parse(readFileSync(flags.into, "utf8"));
      const target = video.scenes?.find((s) => s.id === flags.scene);
      if (!target) throw new Error(`No scene "${flags.scene}" in ${flags.into}.`);
      if (target.kind !== "request-flow")
        throw new Error(`Scene "${flags.scene}" is "${target.kind}", not "request-flow".`);
      target.props = props;
      writeFileSync(flags.into, `${JSON.stringify(video, null, 2)}\n`);
      lines.push(`Wrote the props into scene ${flags.scene} of ${flags.into}.`);
    } else lines.push(`props: ${JSON.stringify(props)}`);
    console.log(
      capLines(lines, "This is what the code says, not live traffic. Say so in the narration."),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
