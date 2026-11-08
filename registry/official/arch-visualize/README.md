# arch-visualize

Reads a project's code and config, works out its architecture (apps, caches, databases, queues, outside services), and writes one self-contained, offline web page: each component with its technology icon, animated request flows travelling between them, and possible risks to check. The page has more than one view of the same model (System, Flows, Security, Failure, AI and, when you compare two versions, Changes), exports to SVG, PNG and print, and has an Arabic interface (a machine draft). Since 0.3.0 a component can open into its functions, components, routes and the calls between them (JavaScript and TypeScript): a smooth zoom, a searchable list, and a numbered trace of what a function calls. Run it on purpose with `/arch-visualize` in Claude Code, then open `docs/architecture.html`.

It shows how requests would travel **according to the code**. It is not live traffic, not a claim that the architecture is best or correct, and every risk is labelled "possible risk to check" with the files it is based on.

## What is in the folder

- `SKILL.md`: the steps the agent follows (built from `SKILL.src.md`). `references/`: the detail, read only when needed (`lenses.md` is the place to start for the views, `ci.md` for pull requests).
- `scripts/`: deterministic Node 18+ helpers, no dependencies, no network, nothing from the project is ever run. Seven commands: `discover` (find components and edge candidates), `model-check` (validate the model), `risk-check` (rules AV-R01 to AV-R18, also as SARIF), `code-map` (0.3.0: look inside a component, JavaScript and TypeScript, as text), `simulate` (what-if: which components fail if others are down), `diff` (compare two models), `render` (write the page). The other files in `scripts/` are modules those commands share.
- `assets/`: the viewer (`viewer/`), the pure modules the page and the scripts share (`lib/`: layout, routing, search, simulation, diff, zoom and the inside-view builder), the technology catalog, the model schema, icons (`icons/NOTICE.md` explains the license and trademarks) and `vendor/babel-parser.mjs`, the parser `code-map` uses (MIT, bundled from `@babel/parser`; `vendor/NOTICE.md` has the licence). It only parses text.
- `preview/`: screenshots of the 0.3.0 page on the Cal.com demo, shown on the skill page. Not installed.
- `evals/`: a multi-service fixture app, its expected results, hostile and lens models, the demo models (Cal.com is the one on the skill page; Supabase, Node.js and DevPath are kept), the baseline and `RESULTS-0.2.0.md` (the only numbers to quote), `LATER.md`. Not installed.

## Decisions taken

- D1 name `arch-visualize`, niche `arch`, aisle "Architecture". D6 `kind: quality`, `tier: specialty`.
- D2 zero dependencies: hand-written SVG, vanilla JS. 0.2.0 (D1): the layout and routing are our own module in `assets/lib/` (layers by tier, long edges through lane slots, grouped bands), tested for overlaps, stability and speed.
- D3 original generic icons plus Simple Icons brand logos (CC0 files, trademarks stay with their owners, used only to identify a technology).
- D4 output `docs/architecture.html` and `docs/architecture.json` (override with `--out`).
- 0.2.0 decisions: schema version 2 with automatic upgrade of version 1 models (D5); click-to-source stays off by default and is not built yet (D4); WebM export is left for later (D3); the viewer stays under 300 KB and the fixture page under 1.5 MB (D6).
- D5 stacks: JavaScript and TypeScript, Prisma, docker-compose, Dockerfile, env example key names, common hosting files; Python and Go dependency files at a basic level.

## Honest limits

- The inside view reads JavaScript and TypeScript only, by parsing text. A component written in another language gets no inside view. Calls are linked only when a name resolves to a symbol in the folders read; dynamic calls and anything built at run time are missed. Links from a tRPC call or a `fetch` to its handler are matched by path and marked as matched by name. Descriptions come from the comment above a symbol; without one there is none (the agent may write up to 30 per component, labelled as written by the agent).

- It never opens `.env` files and reads env example files for key **names** only. Because of that, AV-R09 cannot see a pooled host name that only appears in a value.
- Discovery and the code rules read JavaScript and TypeScript only, by text patterns. Wrappers, injected clients and dynamic names are missed, and an import can look like a connection when it is not, which is why each one is a candidate you confirm. Rules are heuristics and can miss things or flag things that are fine; the page says so.
- Kubernetes manifests are read for service names, environment values that name a service, and replica counts. Terraform, real traffic or telemetry and cloud accounts are not covered.
- Security, AI and Failure views show only what the model records, and the model records only what a file shows. The what-if says what the model implies, not what production would do.
- The Arabic interface text is a machine draft that no native speaker has read yet.
- Not in 0.2.0: click-to-source links, the `--title` flag, WebM export (`evals/LATER.md`).
- Numbers: `evals/RESULTS-0.2.0.md`. Tokens and tool calls per run were not measured.

## Testing it yourself

`registry/skill-tests/arch-visualize*.test.ts` cover every script, every risk rule (a seeded and a benign case each), escaping, the offline guarantee, determinism and the audit. To try the skill by hand, copy `evals/fixture-app` to a scratch folder and run `/arch-visualize` in a fresh Claude Code session.

## Found by dogfooding (a real Next.js, MongoDB, Redis and BullMQ app with AI providers, outside this repo)

The skill was followed by hand on a project the owner chose, read-only (outputs went to a scratch folder, `.env` files were never opened). It first showed 6 of the roughly 12 components. Fixes, each with a test:

- AI provider SDKs (Anthropic, OpenAI, Gemini, Mistral), GitHub OAuth and about 25 other common services were missing from the catalog; env example key names such as `ANTHROPIC_*` and `GITHUB_*` now find them too, with readable labels.
- A compose image the catalog does not know (a code-execution sandbox) was dropped; it now becomes a generic component with its image and ports as evidence.
- An in-process auth library (`next-auth`) drew a box of its own with no connections; it is now evidence on the app.
- AV-R03 and AV-R08 fired on generic compose services and missed a Next.js app's own route handlers; they now look at the app that owns the routes, and AV-R03 recognises a project's own rate-limit helper (`checkRateLimit`, a `rate-limit` folder).
- Edges that skipped a column were drawn behind other components and looked like connections to them; they are now routed through the gaps, and a browser test checks that no edge passes behind a component.
- Not covered, found by reading: a separate WebSocket server process, and a compose file that mounts the Docker socket into the app (added to the model as an agent-sourced risk). A rule for the Docker socket is a candidate for a later version.

## Changes

- **0.3.0**: the inside view. `code-map.mjs` reads JavaScript and TypeScript as text and lists the functions, React components, hooks, Next.js routes and tRPC procedures of a folder, what each calls, renders, fetches or sends, whether a call sits in a loop or a branch, and where each import comes from. `--attach` puts them on the nodes of the model (model version 3: `nodes[].detail`, `edges[].via`), `--focus` follows one journey from an entry file. The page opens a component with a smooth zoom (double-click, `Z`, or the panel button), with a list you can filter (by name, file or description), tabs for components, functions, routes and hooks, and a numbered trace of what a function calls (Step, Play, Back; `[` `]` `P` `L`). Search finds functions too, and `#in=<node>&sym=<file>#<name>` links to one. Model-check verifies each symbol's file and line on disk with `--root`. The demo is Cal.com (one journey: connecting a calendar). Each page is about 80 KB larger than in 0.2.0 because of the viewer code. Not measured: tokens or tool calls per run; nothing here is a performance claim.

- **0.2.0**: model version 2 (older models are upgraded in memory). A new viewer with its own layout, search, path trace, minimap and deep links; views for Security, Failure (what-if), AI and Changes; an Arabic interface with right-to-left layout; SVG, PNG and print export; `simulate.mjs` and `diff.mjs`; risk rules AV-R11 to AV-R18, each with options and their trade-offs, and SARIF output for pull requests (`references/ci.md`); discovery proposes edge candidates with confidence and evidence, and reads Kubernetes, MCP configs, skills and vector stores. A model is refused while any candidate is left. Measured results: `evals/RESULTS-0.2.0.md`. Not included: click-to-source links, `--title`, WebM.

- **0.1.1**: when the generated page is embedded in another page (an iframe), a plain mouse-wheel scroll now scrolls that page instead of zooming the diagram; zoom with Ctrl or Cmd plus the wheel, the + and - buttons, or a pinch. Nothing else in the installed files changed.
- **0.1.0**: first release.
