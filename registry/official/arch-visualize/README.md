# arch-visualize

Reads a project's code and config, works out its architecture (apps, caches, databases, queues, outside services), and writes one self-contained, offline web page: each component with its technology icon, animated request flows travelling between them, and possible risks to check. Run it on purpose with `/arch-visualize` in Claude Code, then open `docs/architecture.html`.

It shows how requests would travel **according to the code**. It is not live traffic, not a claim that the architecture is best or correct, and every risk is labelled "possible risk to check" with the files it is based on.

## What is in the folder

- `SKILL.md`: the steps the agent follows (built from `SKILL.src.md`). `references/`: the detail, read only when needed.
- `scripts/`: deterministic Node 18+ helpers, no dependencies, no network, nothing from the project is ever run: `discover` (find components), `model-check` (validate the model), `risk-check` (rules AV-R01 to AV-R10), `render` (write the page).
- `assets/`: the viewer template, the technology catalog, the model schema, and icons (`icons/NOTICE.md` explains the license and trademarks).
- `preview/`: screenshots of the fixture app's page, shown on the skill page. Not installed.
- `evals/`: a small multi-service fixture app (Next.js, Express, BullMQ worker, Redis, Postgres, Stripe, Resend), its expected results and a hostile model used for escaping tests. Not installed.

## Decisions taken

- D1 name `arch-visualize`, niche `arch`, aisle "Architecture". D6 `kind: quality`, `tier: specialty`.
- D2 zero dependencies: hand-written SVG, a layered layout by tier, vanilla JS.
- D3 original generic icons plus Simple Icons brand logos (CC0 files, trademarks stay with their owners, used only to identify a technology).
- D4 output `docs/architecture.html` and `docs/architecture.json` (override with `--out`).
- D5 stacks: JavaScript and TypeScript, Prisma, docker-compose, Dockerfile, env example key names, common hosting files; Python and Go dependency files at a basic level.

## Honest limits

- It never opens `.env` files and reads env example files for key **names** only. Because of that, AV-R09 cannot see a pooled host name that only appears in a value.
- Code rules (AV-R02 to AV-R06, AV-R08) read JavaScript and TypeScript only. Rules are heuristics and can miss things or flag things that are fine; the page says so.
- Not covered: Kubernetes, Terraform, real traffic or telemetry, cloud accounts.
- No eval numbers exist, so the skill page shows screenshots only.
- The layout puts one tier per column; a large system shrinks to fit (zoom and Fit are in the page).

## Testing it yourself

`registry/skill-tests/arch-visualize.test.ts` covers every script, every risk rule (a seeded and a benign case each), escaping, the offline guarantee, determinism and the audit. To try the skill by hand, copy `evals/fixture-app` to a scratch folder and run `/arch-visualize` in a fresh Claude Code session.
