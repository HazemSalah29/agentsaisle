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

## Found by dogfooding (a real Next.js, MongoDB, Redis and BullMQ app with AI providers, outside this repo)

The skill was followed by hand on a project the owner chose, read-only (outputs went to a scratch folder, `.env` files were never opened). It first showed 6 of the roughly 12 components. Fixes, each with a test:

- AI provider SDKs (Anthropic, OpenAI, Gemini, Mistral), GitHub OAuth and about 25 other common services were missing from the catalog; env example key names such as `ANTHROPIC_*` and `GITHUB_*` now find them too, with readable labels.
- A compose image the catalog does not know (a code-execution sandbox) was dropped; it now becomes a generic component with its image and ports as evidence.
- An in-process auth library (`next-auth`) drew a box of its own with no connections; it is now evidence on the app.
- AV-R03 and AV-R08 fired on generic compose services and missed a Next.js app's own route handlers; they now look at the app that owns the routes, and AV-R03 recognises a project's own rate-limit helper (`checkRateLimit`, a `rate-limit` folder).
- Edges that skipped a column were drawn behind other components and looked like connections to them; they are now routed through the gaps, and a browser test checks that no edge passes behind a component.
- Not covered, found by reading: a separate WebSocket server process, and a compose file that mounts the Docker socket into the app (added to the model as an agent-sourced risk). A rule for the Docker socket is a candidate for a later version.
