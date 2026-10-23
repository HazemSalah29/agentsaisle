---
name: db-optimize-query
description: Speed up a slow SQL query by reading its execution plan, finding missing indexes and N+1 patterns, and proving the change with before and after timings. Use when the user reports a slow query, a slow page caused by the database, or asks to review query performance. Do not use for schema design or migrations.
model: sonnet
effort: medium
allowed-tools: Read Write Edit Glob Grep Bash(node *) Bash(psql *)
---

# Query optimization

## Use when
- A query or page is slow and the cause is the database.
- The code loops and runs one query per item (N+1).

## Don't use when
- The problem is schema shape (use `db-schema`) or a risky table change (use `db-migrate`).
- The engine is not PostgreSQL and no plan output is available. Say so and reason from the query alone.

## Steps
1. Get the slow query and the real parameters. Ask for `EXPLAIN` access if you do not have it; never guess timings.
2. Capture the baseline: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) <query>` saved to `before.json` (psql: `-At`). Run it twice; use the second run.
3. Run `node <skill>/scripts/explain-summary.mjs before.json`. Read the findings: sequential scans, wrong row estimates, many loops, disk sorts.
4. Change one thing: an index that matches the filter and sort order, a rewritten join, fetching in one query instead of many, `ANALYZE` for stale statistics. Never add an index you cannot justify from the plan.
5. Capture `after.json` the same way and run `node <skill>/scripts/explain-summary.mjs before.json after.json`.
6. If the change is an index, hand it to `db-migrate` rules: create it concurrently.

## Budget
<!-- include: _shared/read-budget.md -->
- Never paste a full plan into the conversation; use the script's summary.

## Output
- The change, the before and after timings from the script, and the remaining findings, if any.

## Done when
- The after plan shows the improvement in the script's comparison.
- No new problems appear in the comparison.
- Results are reported as measured on this machine and data, not as a promise.
