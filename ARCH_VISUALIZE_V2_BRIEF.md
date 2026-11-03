# ARCH_VISUALIZE_V2_BRIEF.md: upgrade `arch-visualize` to 0.2.0

A brief for upgrading the existing official skill `registry/official/arch-visualize` (currently 0.1.1) in the Agent Aisle repo. Read all of it before you start. Work in milestones (section 11). Start each milestone in plan mode and get the plan approved. Stop after each one with a short summary: **built / tested / decisions needed**.

---

## 1. Goal

Make the page that `arch-visualize` produces the clearest, most useful offline architecture diagram an agent can generate. It should look professional at first glance and hold up under close reading. It should also answer questions other diagram tools don't: *what breaks if this goes down, where does sensitive data travel, which parts are AI agents and how safe are they, and what changed in this pull request*.

Two parts of the current skill are worth keeping, and they stay central:
- **Evidence on every node and edge.** Inferred items are drawn dashed.
- **Safety-first scripts.** No network, never reading `.env`, deterministic output.

## 2. Positioning against similar tools (read, then don't copy)

Other open-source tools work the same way: the LLM writes a JSON model, a script checks it, and a deterministic renderer draws HTML/SVG. Archify (tt-a1i/archify) is one of them. It offers several diagram types, PNG/SVG/video export, snapshot diffs, click-to-source and a bilingual UI.

- **Parity target:** good automatic layout, export to SVG and PNG, click-to-source, before/after diff, more than one view of the system, and a second UI language.
- **Where we go further:**
  - one model shown through several **lenses**;
  - failure simulation;
  - a security and data-flow lens;
  - an AI-layer lens that links to `aisle audit` grades;
  - risk rules with suggested fixes;
  - a CI check that emits SARIF;
  - Arabic/RTL;
  - **measured** results on our own evals.
- **IP rule (strict):** don't read another tool's source code while building this. Don't copy code, layouts, visual style, icons or wording. Build from this brief and from public standards (SVG, layered graph drawing, SARIF, OpenTelemetry).
- **Claims rule:** user-facing files (README, preview, `skill.meta.yaml`, the page) never name another tool and never say "better than X". We only publish numbers we measured (section 10).

## 3. Standing rules (unchanged from 0.1.0; they apply to every line)

- **No new dependency without asking.** This includes any library bundled into `assets/`. See decision D1.
- **Never run anything from the user's project.** Read its files as text only.
- **Never read secret values.**
  - Never open `.env`, `.env.local`, `.env.*.local` or files ignored as secret.
  - From `.env.example`, `.env.sample` and `.env.template`, read key names only.
  - The secret canary must stay invisible in every output.
- **No network.** Scripts make no network calls. The page makes no external requests: no CDN, fonts, remote icons or analytics. It works from `file://`.
- **Scripts:**
  - Node 18+, with zero runtime dependencies.
  - Deterministic: the same input gives byte-identical output.
  - Read-only, except for the files they are told to write.
  - stdout capped at 40 lines.
  - Self-starting with the existing `realpathSync` pattern.
- **House standard:**
  - `SKILL.md` stays at most 150 lines, written as `SKILL.src.md` with shared includes.
  - `references/` stays one level deep.
  - `pnpm skills:build`, `pnpm skills:check` and `pnpm lint:skills` pass.
- **Honesty:**
  - Every risk is a "possible risk to check" with evidence.
  - A simulation result is a "what-if from the model", never a prediction about production.
- **External facts** (library licenses, browser APIs, SARIF fields, OTLP JSON shape): check current docs. Mark anything still uncertain `TODO(verify)`.
- **Process:**
  - Work on `stage`, in small commits, with tests in each commit.
  - Merge to `main` by pull request.
  - Push the tag `arch-visualize@0.2.0` **before** merging.
  - Add generated files and intentionally odd fixtures to `.prettierignore`.

## 4. Read first (milestone 0, no code changes)

Read these before planning anything:
- `SKILL.md`
- `skill.meta.yaml`
- all of `references/*.md`
- all of `scripts/*.mjs`
- `assets/model.schema.json`
- `assets/tech-catalog.json`
- `assets/viewer.html` (about 1,900 lines: layout starts near line 747, flow animation near line 1,775)
- `evals/` (`fixture-app`, `fixture-model.json`, `hostile-model.json`, `expected.json`, `demo/devpath.architecture.json`)
- `registry/skill-tests/arch-visualize.test.ts` and `load.ts`

Then record a **baseline** in `evals/BASELINE.md`:
1. Render the fixture and the DevPath demo. Take screenshots at 1440×900 and 390×844, light and dark.
2. Measure:
   - `viewer.html` size in bytes;
   - render time for the fixture;
   - discover recall on the fixture: components found ÷ expected, edges found ÷ expected. The DevPath run found 11 of 12 components and 2 of 13 connections.
3. If an eval-run log exists, note the tokens and tool calls for one full skill run on the fixture. If not, say how you will measure them in M8.

Everything later is compared with this file.

## 5. Decisions needed from Hazem (ask; don't assume)

- **D1 Layout engine.**
  - (a) Write our own layered layout as a pure, dependency-free module. **Recommended**: it keeps zero dependencies and lets us tune it.
  - (b) Bundle `dagre` (MIT) into `assets/vendor/`.
  - (c) Bundle `elkjs`. Its license is EPL-2.0, `TODO(verify)`. Check whether it is compatible with the repo license before even proposing it.

  Whatever is chosen must be deterministic and run in both Node (for tests) and the page.
- **D2 Visual tests.** Use Playwright as a **devDependency** for screenshot checks, or skip pixel tests and keep DOM and geometry tests only. Ask first.
- **D3 Video export (WebM).** In 0.2.0, or later? Recommendation: later. SVG and PNG first.
- **D4 Click-to-source default.** Recommended: off by default, because `vscode://file/<absolute path>` puts the user's home path (often their username) inside a shareable HTML file. Turned on with `render.mjs --source-links vscode --abs-root <path>`. With it off, clicking evidence copies `file:line`.
- **D5 Schema version.** Recommended: `version: 2`, with `model-check` auto-upgrading v1 models in memory and `--write-upgrade` to save them. v1 models must still render.
- **D6 Size budget for `viewer.html`.** Recommended: at most 300 KB before icons and model, at most 1.5 MB for the fixture page. Fail the build when it is over.

## 6. Model v2 (schema changes; all additive)

Update `assets/model.schema.json`, `references/model-schema.md` and `model-check.mjs`. New optional fields:

**Nodes**
- `group`: id of a container (deploy unit, k8s namespace, monorepo package). Groups are drawn as boxes around their nodes.
- `zone`: trust zone, one of `public`, `dmz`, `private`, `third-party`, `user-device`.
- `data`: what the node stores or handles, from `pii`, `credentials`, `payments`, `health`, `secrets-ref`, `logs`. Labels only, never values.
- `replicas`: a number or `"unknown"`, taken from compose, k8s or IaC if evidence exists.
- `ai`: `{ kind: "llm-provider" | "agent" | "mcp-server" | "skill" | "vector-store", auditGrade?: "A".."F", auditSource?: path }`.
- `owner`: optional free text, such as a team.

**Edges**
- `auth`: one of `none`, `session`, `jwt`, `api-key`, `mtls`, `oauth`, `unknown`.
- `tls`: `true`, `false` or `"unknown"`.
- `timeoutMs`, `retries`: with evidence (a file and line where they are set), otherwise left out.
- `carries`: data labels, as for nodes.
- `optional`: `true` when the caller degrades gracefully if the callee fails, with evidence such as a try/catch fallback or a circuit breaker.

**Top level**
- `groups`: `[{ id, label, kind, evidence }]`.
- `views`: optional saved camera, lens and focus per view, so the agent can ship "start here" views.

**Rules `model-check` must enforce (new)**
- Every new field that claims a fact (`timeoutMs`, `retries`, `tls: true`, `auth`, `replicas`, `optional`) needs evidence, or `"unknown"`.
- `ai.auditGrade` only when `auditSource` points at a real `aisle audit` JSON file in the project.
- `group` and `zone` ids must exist. No cycles in groups.
- No string anywhere may look like a secret. Reuse the existing secret masker and the canary test.

## 7. The new viewer (the main work)

Keep it **one self-contained HTML file**. `render.mjs` now builds it from parts:
- `assets/viewer/` holds `index.html`, `styles.css`, `i18n.json` and `src/*.js`;
- the shared pure modules live in `assets/lib/` (layout, routing, simulation, diff).

`render.mjs` inlines them all. The pure modules are plain ES5/ES2017 with no DOM, so tests import them in Node and the page runs the same code.

### 7.1 Layout and drawing (D1)

- **Layered layout** in the direction of the request: clients → edge → frontend → backend → async → data → external. Pipeline:
  1. Tiers set the layers.
  2. Order within layers by barycenter, with a few sweeps.
  3. Place coordinates with no overlaps.
  4. Groups become containers.
- **Edge routing:**
  - orthogonal lines with rounded corners;
  - ports spread along each side of a node, so lines don't stack;
  - few crossings, and none through nodes;
  - edge labels (protocol) placed where they don't collide with anything.
- **Determinism:** the same model gives the same coordinates. Ties break by id. A test checks a stable hash of the layout.
- **Scale:** 150 nodes and 300 edges lay out in under 300 ms in Node. Pan and zoom stay smooth (rough target: 60 fps on a mid laptop).
- **Level of detail:**
  - zoomed out: tier bands and group boxes, with icons only;
  - mid zoom: labels;
  - zoomed in: technology, risk badge and edge labels.
- **Visual design** (original; write a short `references/visual-design.md`):
  - a calm neutral background;
  - one accent colour per lens;
  - a type scale with at most 3 sizes;
  - node cards with an icon, a label and a technology line;
  - risk and AI badges in fixed corners;
  - solid for evidence, dashed for inferred;
  - full light and dark themes, with contrast checked at WCAG AA.

### 7.2 Lenses (one model, several views)

A lens switcher sits above the diagram. Each lens changes colour, emphasis and the side panel, never the layout, so the user keeps their place.

1. **System:** the default. Tiers and groups.
2. **Flows:** the current animated request flows, improved:
   - focus mode dims everything outside the flow;
   - responses travel back on the same route;
   - parallel steps animate together;
   - the timeline in the panel can be scrubbed.
3. **Security:**
   - trust zones are drawn as background regions;
   - edges that cross a zone are highlighted;
   - `auth` and `tls` are shown on each edge, with "unknown" called out;
   - nodes and edges carrying `data` labels are tinted.
   - A "where does PII go?" button traces every path from PII-carrying nodes.
4. **Failure (what-if):** click a node and choose **Simulate down**. The shared `simulate.js` module:
   - spreads the failure along incoming sync edges, stopping where `optional: true` with evidence;
   - marks async callers as delayed (the queue builds up), not failed;
   - marks the flows that break, and at which step.

   Results show as **failed / degraded / unaffected**, with the reason chain ("API fails because `orders.ts:41` calls Redis without a fallback"). Labelled "what-if from the model".
5. **AI layer:**
   - LLM providers, agents, MCP servers, skills and vector stores are highlighted;
   - the `aisle audit` grade shows when there is evidence;
   - tool permissions (from skill frontmatter, if the skill is in the repo) appear in the panel.

   This links the visualizer to the rest of Agent Aisle.
6. **Diff:** only when a diff model is loaded (section 8.2). Added items are green, removed items red ghost outlines, changed items amber, with a list in the panel.

### 7.3 Finding things

- **Search:** press `/` to search labels, technology, file paths and risk ids. Results highlight on the diagram and the camera centres on them.
- **Path trace:** pick A, then B. Show every path from A to B and their hop counts. Mark sync and async segments.
- **Minimap** in a corner, clickable.
- **Deep links:** the URL hash stores the lens, selection, flow step and camera (`#lens=failure&node=redis`). Opening the file with that hash restores the view, so links in a PR comment land on the right spot.

### 7.4 Side panel

- **Component:** role, technology, group, zone, data labels, evidence list (`file:line`, copy or open per D4), connections in and out, and risks.
- **Risk:**
  - rule id and severity;
  - **why it matters** (one line);
  - **suggested fix** (one to three concrete options with trade-offs);
  - **What-if** button: runs the failure simulation for the risk's subject.
- **Flow:** the scrubbable step list.

### 7.5 Export

- **SVG:** serialise the current view with styles inlined and no external references. Respect the current lens and theme.
- **PNG:** draw that SVG on a canvas at 1×, 2× or 3× and download it. `TODO(verify)` that this works from `file://` in Chrome, Firefox and Safari without tainting the canvas. If Safari fails, show a clear message and offer SVG.
- **Print / PDF:** a print stylesheet with one diagram page plus one page listing risks.
- **Model JSON:** download the embedded model.
- **WebM:** only if D3 says so.

### 7.6 Language, direction, accessibility

- Every string the UI shows comes from `i18n.json`, in English and Arabic. `render.mjs --lang ar` sets `lang` and `dir="rtl"`.
- In RTL, the panel and toolbar mirror.
- The diagram flow direction is a separate option (`--flow-dir ltr|rtl`, default `ltr`), because some readers want requests to travel left to right even in Arabic.
- Use logical CSS properties (`margin-inline-start` and so on).
- Keep everything 0.1.0 already does:
  - keyboard focus and selection;
  - arrow keys to pan, `+` and `-` to zoom;
  - reduced motion;
  - the list view on narrow screens.
- Add:
  - announcements of the flow step and simulation result in a live region;
  - focus that moves to the panel on selection and returns with `Esc`.
- Labels, notes and paths are always set as text, never as HTML. The escaping canary from `hostile-model.json` must stay inert in every lens, in search results, in exports and in the print view.

## 8. Scripts

### 8.1 Better discovery (`discover.mjs`)

Edge recall is the weakest point (2 of 13 connections on DevPath). Add **edge candidates with evidence** to the draft, still by reading text only:
- `docker-compose` `depends_on`, `links` and `networks`; k8s Service and Deployment names; env key **names** in example files (such as `REDIS_URL` or `DATABASE_URL`) as hints that a connection exists, never values;
- client construction: database drivers and ORMs, Redis clients, queue producers and consumers, HTTP clients with a base URL from config, SDKs for well-known external services (from `tech-catalog.json`);
- queues: match producer topic and queue names to consumer names;
- AI layer: LLM SDK imports, MCP server configs (`.mcp.json`, `mcp.json`), `SKILL.md` folders, vector-store clients;
- `timeoutMs` and `retries` where they are set as literals near the client;
- try/catch or fallback around a call → an `optional` candidate.

Every candidate carries a `confidence` (`high` / `medium` / `low`) and its evidence. The agent confirms or drops candidates; low-confidence ones that are kept go in `inferred`.

Grow `evals/fixture-app` so it covers every new pattern, and update `expected.json`. Target: edge recall on the fixture of at least 0.8, up from the baseline. Report the real number.

### 8.2 New and updated scripts

- **`risk-check.mjs`:**
  - New rules continue from AV-R11. Candidates:
    - a sync call with no timeout evidence;
    - retries without backoff evidence;
    - an edge that crosses zones with `auth: none` or `tls: false`;
    - PII reaching a third-party zone or logs;
    - an AI agent with write or exec tools and no audit grade;
    - an audit grade of D or F;
    - fan-out of more than N sync calls in one flow step;
    - a single replica on a node that 3 or more flows depend on.
  - Every rule, old and new, gets `why` and `fixes[]`. Text lives in the script as data, so tests can check it.
  - `--format sarif` writes SARIF 2.1.0 (`TODO(verify)` the fields) with the model JSON path as the location. Where a risk has file evidence, it also points at that file and line.
- **`simulate.mjs`:** `--model --down <nodeId>[,<nodeId>] [--json]`. A thin wrapper over `assets/lib/simulate.js`, so the agent can quote results in its reply.
- **`diff.mjs`:** `--base <old.json> --head <new.json> --out docs/architecture.diff.json`. It matches nodes by id, then by technology and evidence file, so renames are detected. `render.mjs --diff <file>` turns on the Diff lens.
- **`render.mjs`:** new flags `--lang`, `--flow-dir`, `--diff`, `--source-links`, `--abs-root`, `--lens` (default lens), `--title`. It still refuses to overwrite without `--force`.

### 8.3 CI recipe (no LLM in CI)

Write `references/ci.md` with an example GitHub Actions workflow. The team commits `docs/architecture.json`. On each PR the workflow:
1. runs `model-check`;
2. runs `risk-check --format sarif` and uploads the SARIF result;
3. runs `diff.mjs` against the base branch's model;
4. renders the page with the Diff lens as a build artifact.

`TODO(verify)` the current action names and versions for uploading SARIF and artifacts. Ship the workflow as documentation only; don't add it to this repo's own `.github/`.

## 9. SKILL.md changes (stay within 150 lines)

- **Steps:**
  - Discover now proposes edge candidates: confirm or drop each one.
  - Fill zones, data labels, auth/tls and AI fields only with evidence.
  - Run `simulate.mjs` on the top one or two risky nodes and mention the result in the reply.
  - Offer the Diff lens when an older `docs/architecture.json` exists. Copy it to `docs/architecture.base.json` before overwriting it.
- **Output:** add the lens list, the simulation summary, the edge-candidate counts (confirmed, dropped, inferred) and the export options.
- **References:** move detail out of `SKILL.md` into the references (`lenses.md`, `simulation.md`, `security-lens.md`, `ci.md`, `visual-design.md`). Update the existing references.

## 10. Tests and measurements

Add to `registry/skill-tests/arch-visualize.test.ts`, or split it into files. All existing tests keep passing.

- **Pure modules** (Node, no DOM):
  - layout: no overlaps, every node inside its group, stable hash, 150-node timing;
  - routing: no segment passes through a node;
  - simulation: hand-checked cases (optional edge stops the spread, async marked degraded, flows broken at the right step);
  - diff: add, remove, change, rename.
- **Schema:**
  - every v1 fixture auto-upgrades and renders;
  - each new evidence rule has a failing and a passing case.
- **Security:**
  - the secret canary never appears in the draft, model, page, SARIF, simulate output or diff;
  - the hostile model's strings stay inert in every lens, in search and in SVG export;
  - grep the built page for `http://`, `https://`, `//cdn`, `fetch(`, `XMLHttpRequest`, `import(` and `<link rel=` and allow none, except for text inside the embedded model.
- **Determinism:** render twice and compare byte for byte, for both `--lang en` and `--lang ar`.
- **Size budget** per D6.
- **Visual** (only if D2 says yes):
  - Playwright screenshots of each lens, light and dark, desktop and mobile, compared within a tolerance;
  - keyboard flow (Tab to a node, Enter, Esc);
  - SVG and PNG export download non-empty files.
- **Measured results** go in `evals/RESULTS-0.2.0.md`, next to the baseline:
  - discover recall (components and edges);
  - page size and render time;
  - layout crossings on the fixture and DevPath (count before and after);
  - tokens and tool calls for one full skill run on the fixture, before and after, if measurable.

  Only these numbers may be used in the README, preview text or posts.

## 11. Milestones

Each one starts in plan mode and ends with **built / tested / decisions needed**. Don't start the next one without approval.

- **M0 Baseline and plan:** section 4 and the answers to D1–D6. No code changes.
- **M1 Model v2:** schema, `model-check`, v1 upgrade, references. Tests.
- **M2 Layout and routing:** the pure modules in `assets/lib/` per D1, wired into the current viewer behind the same UI. Determinism, overlap and timing tests. Before/after screenshots of the fixture and DevPath.
- **M3 Viewer rebuild:**
  - split into `assets/viewer/`, inlined by `render.mjs`;
  - the visual design;
  - level of detail, minimap, search, path trace, deep links;
  - the System and Flows lenses;
  - i18n with Arabic/RTL;
  - accessibility.
- **M4 Export:** SVG, PNG and print (WebM per D3).
- **M5 Security, AI and Failure lenses:** `simulate.js` and `simulate.mjs`, the new risk rules with `why` and `fixes`, and the risk panel's What-if button.
- **M6 Discovery:** edge candidates, the bigger fixture, recall measured.
- **M7 Diff and CI:** `diff.mjs`, the Diff lens, SARIF, `references/ci.md`.
- **M8 Release:**
  - `SKILL.md` and the references updated;
  - a new demo regenerated from DevPath;
  - new previews in `preview/` (screenshots of each lens);
  - `RESULTS-0.2.0.md`;
  - `skill.meta.yaml` set to 0.2.0, with the changelog;
  - `pnpm skills:build`, `pnpm skills:check`, `pnpm lint:skills` and the tests all green;
  - tag `arch-visualize@0.2.0` pushed, then the PR from `stage` to `main`.

## 12. Later (not in 0.2.0; write a design note only)

- **Trace replay:** `trace-import.mjs` reads an exported OpenTelemetry trace file (OTLP JSON, `TODO(verify)` the shape) and maps `service.name` to nodes. The Flows lens then replays a **real** request, with timings from the trace. The page would need to say clearly "replayed from a trace file, not live".
- Video export, if it was deferred.
- Python and Go discovery patterns, and Terraform resources as nodes.

## 13. Definition of done for 0.2.0

- Every milestone is approved, and every test and repo check passes.
- A v1 model still renders. The DevPath demo is regenerated and looks clearly better than the baseline screenshots, side by side, in `evals/BASELINE.md` versus `RESULTS-0.2.0.md`.
- Edge recall on the fixture has improved, with the real number reported.
- The page works offline, makes zero external requests, shows no secret, and hostile strings stay inert everywhere.
- Every claim in user-facing text is backed by a number in `RESULTS-0.2.0.md`.
