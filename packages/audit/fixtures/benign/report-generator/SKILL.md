---
name: report-generator
description: Build a weekly status report from a JSON file of tasks. Use when the user asks for a status report. Don't use for financial reports.
allowed-tools: Read Write Bash(node *)
disable-model-invocation: true
---

# Report generator

## Use when

- The user wants a status report from `tasks.json`.

## Steps

1. Run `node scripts/report.mjs tasks.json`.
2. Read the Markdown it prints and tidy the wording.

## Done when

- The report lists done, in-progress and blocked tasks.
