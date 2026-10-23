---
name: db-migrate
description: Plan and write safe database migrations with reversible SQL, backfills and lock-time warnings, checked by a linter. Use when the user asks to change a table, add or drop a column or index, rename something or backfill data in an existing database. Do not use for designing a new schema from scratch or tuning queries.
model: sonnet
effort: medium
allowed-tools: Read Write Edit Glob Grep Bash(node *)
---

# Database migrations

## Use when
- Any change to a table that already holds data or is used by running code.

## Don't use when
- A brand-new schema with no data (use `db-schema`).
- The task is query speed (use `db-optimize-query`).

## Steps
1. Find the engine and the migration tool (Prisma, Drizzle, Knex, Rails, Alembic, Flyway, plain SQL). Follow its file format and numbering. Read `references/<engine>.md` for the engine.
2. State the change as steps that each keep running code working (expand, then contract): add the new thing, backfill, switch the code, remove the old thing in a later release.
3. Write the up migration and a down migration. Mark any step that cannot be undone as one-way, and say why.
4. Backfill in batches with a stable order, not one giant `UPDATE`.
5. Run `node <skill>/scripts/migration-lint.mjs <file> --engine <engine> --require-down`. Fix every warning or explain it in the output.
6. Apply to a copy or empty database when one exists, then roll back and apply again.

## Budget
- Search first (grep, glob, symbol search). Read line ranges, not whole files.
- Read at most 8 files per step. If you need more, write down what you learned and narrow the question.
- Do not re-read a file you just wrote or edited.
- Prefer the smallest command output that answers the question: head, tail, quiet flags, filtered lists.
- Read the table definition and the code that touches it, not the whole schema.

## Output
- The migration file(s), the lint output, and a rollout order if more than one release is needed.

## Done when
- `migration-lint.mjs` has no warnings left, or each is explained.
- Up and down both run on a test database, when one is available.
- Nothing destroys data in the same release that stops using it.
