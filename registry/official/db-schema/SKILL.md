---
name: db-schema
description: Design or review a relational database schema from requirements, producing normalized tables, keys, constraints and indexes as a migration plus a short ER summary. Use when the user asks to design tables, model data, add an entity or review a schema. Do not use for query tuning, data migration of existing rows or non-relational stores.
model: sonnet
effort: medium
allowed-tools: Read Write Edit Glob Grep Bash(node *)
---

# Database schema

## Use when
- New tables or a new feature that needs stored data.
- A schema review: missing keys, indexes or constraints.

## Don't use when
- The task is a slow query (use `db-optimize-query`) or changing a live table safely (use `db-migrate`).
- The data is not relational (documents, key-value).

## Steps
1. Find the engine and existing schema (migrations folder, ORM models, `schema.sql`). Match their naming and id style. Ask only if the engine is unclear.
2. List entities, their relationships (one-to-many, many-to-many via a join table) and the questions the app asks of the data.
3. Write the DDL: a primary key on every table, `NOT NULL` unless absence is meaningful, foreign keys with an explicit `ON DELETE`, `UNIQUE` for natural keys, `CHECK` for small fixed sets. Timestamps in UTC. Money as integer minor units or `numeric`, never float.
4. Index every foreign key and every column used to filter or sort in the app's real queries. No speculative indexes.
5. Run `node <skill>/scripts/er-summary.mjs <file.sql>`. Fix every finding it prints.
6. Put the DDL in the project's migration format. Do not change existing migrations; add a new one.

## Budget
- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.
- Read the schema and the models, not the whole codebase.

## Output
- The migration file, the ER summary (the script's output), and one sentence per non-obvious choice.

## Done when
- `er-summary.mjs` reports no problems.
- Every foreign key is indexed and every table has a primary key.
- The migration applies cleanly to an empty database, when one is available.
