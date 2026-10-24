---
name: db-seed
description: Generate realistic, deterministic seed or fixture data for a database from a short spec, as SQL inserts, JSON or CSV, with a seed so reruns match. Use when the user needs sample data, test fixtures or a populated development database. Do not use to copy or anonymize production data.
model: sonnet
effort: low
allowed-tools: Read Write Edit Glob Grep Bash(node *)
---

# Database seed data

## Use when
- Development or test data is needed, with believable names, emails, dates and relationships.

## Don't use when
- The data must come from production. Never copy real personal data; ask the user to follow their own anonymization process.

## Steps
1. Read the schema (migrations or models) for tables, column types and foreign keys.
2. Write a spec file `seed.spec.json`: tables, row counts, and a generator per column. Use `{ "ref": "table.column" }` for foreign keys. Generators: serial, uuid, fullName, firstName, lastName, email, company, city, word, sentence, bool, int, decimal, oneOf, timestamp, date, constant. See `references/spec.md`.
3. Run `node <skill>/scripts/seed-data.mjs seed.spec.json --seed 42 --format sql --out seed.sql`. The same seed always gives the same rows.
4. Check the output against the schema: required columns present, uniques not repeated, enum values valid.
5. Load it into a development database only, when one is available, and say how.

## Budget
<!-- include: _shared/read-budget.md -->
- Generate small sets first (10 to 50 rows per table); scale only when asked.

## Output
- The spec file, the generated file path, the seed used and the load command.

## Done when
- The script runs without errors and the output loads into the schema, when a database is available.
- Re-running with the same seed gives identical output.
- Emails use `example.com`; no real people or companies appear.
