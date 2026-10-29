# arch-visualize: how it works

A plain-language guide to the `arch-visualize` skill (version 0.1.0): what it does, how each part works, what it will and will not do, and how to test it yourself.

The skill's own files are in `registry/official/arch-visualize/`. This document explains them; it is not installed with the skill.

## 1. What it is

`arch-visualize` is a skill for a coding agent (Claude Code, Codex, Cursor). You install it with `npx @agentsaisle/cli add arch-visualize` and start it on purpose by typing `/arch-visualize` in your project. The agent then:

1. reads your project's code and config **as text**,
2. works out the architecture: the apps, caches, databases, queues and outside services, and how they connect,
3. writes **one self-contained web page**, `docs/architecture.html`, that you open in a browser (it works offline).

The page shows every component with its technology logo, the connections between them, **animated requests travelling through the system** (for example browser → API → Redis → database → back), and a list of **possible risks** you may not have noticed, such as a single database with no backup, or a database query inside a loop.

It is **not** live monitoring, it does not say any architecture is "best", and it is not a UI mock-up tool, a code-level call graph or a cloud-account scanner. Everything it shows comes from the files it read. The page says so in its header: "Generated from code; not live traffic."

It is not an `aisle` command. `aisle` installs skills; this skill runs inside the agent.

## 2. The four stages

Scripts gather facts the same way every time. The agent adds judgment. Scripts then check and draw.

```
discover.mjs ──▶ architecture.draft.json ──▶ the agent completes the model ──▶ model-check.mjs
  (finds parts)     (parts + evidence)        (links, flows, labels)             (is it valid?)
                                                                                      │
                          risk-check.mjs ◀────────────────────────────────────────────┘
                          (adds possible risks)
                                 │
                                 ▼
                           render.mjs ──▶ docs/architecture.html
```

| Stage       | Who                                      | What happens                                                                                                                                                                  |
| ----------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Discover | `discover.mjs`                           | Finds components and the evidence for each, writes a draft model.                                                                                                             |
| 2. Model    | the agent                                | Reads only the files needed to connect components, finishes the model: friendly labels, connections with evidence, 1 to 5 request flows, anything unproven marked "inferred". |
| 3. Check    | `model-check.mjs`, then `risk-check.mjs` | Validates the model, then adds rule-based possible risks.                                                                                                                     |
| 4. Render   | `render.mjs`                             | Puts the model and the icons into the page template and writes one HTML file.                                                                                                 |

The agent follows `SKILL.md` (59 lines). Detail lives in `references/` and is read only when needed, which keeps the agent's reading small.

## 3. The scripts

All four are plain Node.js (version 18 or newer) with **no dependencies**. They never use the network, never run or import anything from your project, and print at most 40 lines. Given the same input they produce byte-identical output.

### discover.mjs

`node scripts/discover.mjs --root . --out docs/architecture.draft.json`

Reads, as text only: `package.json` (any folder depth), `schema.prisma`, `docker-compose.yml`, `Dockerfile`, `.env.example` / `.env.sample` / `.env.template` (variable **names** only), `vercel.json`, `netlify.toml`, `fly.toml`, `render.yaml`, `wrangler.toml`, and at a basic level `requirements.txt`, `pyproject.toml`, `go.mod`.

How it decides what exists, using `assets/tech-catalog.json` (68 known technologies, 55 with their own logo):

- a dependency such as `next`, `express`, `ioredis`, `pg`, `bullmq`, `stripe`, `openai` becomes a component with a role (frontend, backend, cache, database, queue, external ...);
- each docker-compose service with an `image` becomes a component, and `depends_on` becomes a draft connection; an image the catalog does not know still appears, as a generic component;
- `datasource provider = "postgresql"` in Prisma identifies the database engine;
- env names such as `REDIS_URL` or `ANTHROPIC_*` add evidence or reveal a service the code does not import;
- libraries that run **inside** an app (an auth library) become evidence on that app, not a box of their own;
- the same technology found in several places merges into one component with several pieces of evidence.

Safety: it walks at most 2,000 files, skips files over 2 MB, skips `node_modules`, `.git`, `.next`, `dist`, build and cache folders, ignores symbolic links, and **never opens** `.env`, `.env.local`, `.env.*.local`, `*.pem`, `*.key` (it only counts them by name and says so). The summary lists components found, files read and anything skipped.

### model-check.mjs

`node scripts/model-check.mjs --model docs/architecture.json [--draft]`

Validates the model against `assets/model.schema.json` with a small built-in validator, then checks the links between the parts:

- every node and edge has evidence (file and line) **or** is listed as inferred;
- connections point at real components; every flow step points at a real connection;
- roles, tiers and technology ids are known (`generic-<role>` when unknown);
- evidence paths are relative (no absolute paths, no `..`);
- **no string looks like a credential** (keys, tokens, `user:password@host`); the message never prints the value.

Exit 0 means valid, 1 means a list of problems (at most 40 lines), 2 means it could not run. `--draft` allows a model with no flows yet.

### risk-check.mjs

`node scripts/risk-check.mjs --model docs/architecture.json --root .`

Reads the project's source as text, finds the ten possible risks in section 5 and writes them into the model with `source: "rule"`. It replaces its own earlier results and keeps risks the agent added, so running it twice changes nothing. It always exits 0 when it ran; risks are not failures. Comments are ignored, so a keyword in a comment never triggers a rule.

### render.mjs

`node scripts/render.mjs --model docs/architecture.json --out docs/architecture.html [--force]`

Runs the model checks first (it refuses an invalid model), picks an icon per component (the brand logo, otherwise a generic icon for its role), embeds the model and icons into the page template and writes one file. It refuses to overwrite a file that is not one of its own pages unless you pass `--force`.

## 4. The model file

`docs/architecture.json` is the single record shared by all stages. In short:

```json
{
  "version": 1,
  "project": "shop",
  "nodes": [
    {
      "id": "api",
      "label": "Shop API",
      "role": "backend",
      "tech": "express",
      "tier": "backend",
      "evidence": [{ "file": "apps/api/package.json", "line": 6 }]
    }
  ],
  "edges": [
    {
      "id": "api-cache",
      "from": "api",
      "to": "cache",
      "protocol": "TCP (Redis)",
      "sync": true,
      "evidence": [{ "file": "apps/api/src/lib/session.ts", "line": 3 }]
    }
  ],
  "flows": [
    {
      "id": "load-profile",
      "name": "User loads their profile",
      "steps": [
        { "edge": "web-api", "label": "GET /api/me" },
        { "edge": "api-cache", "label": "Look up session" },
        { "event": "cache-miss", "node": "cache" },
        { "edge": "web-api", "reverse": true, "label": "200 OK" }
      ]
    }
  ],
  "risks": [],
  "inferred": ["edge:bullmq-cache"]
}
```

- **Roles:** client, edge, frontend, backend, worker, queue, cache, database, storage, search, auth, external, observability.
- **Tiers** decide the column in the picture: clients, edge, frontend, backend, async, data, external.
- **Evidence** is the honesty mechanism. Anything the agent believes exists but cannot point at in a file goes in `inferred`, and the page draws it dashed and says so.
- A flow step moves a dot along a connection; `reverse: true` is the response travelling back; an `event` flashes a component (for example a cache miss).
- Full field list: `references/model-schema.md`.

## 5. The ten possible risks (AV-R01 to AV-R10)

Each is shown as "possible risk to check" with its evidence, why it matters and what to check. Rules marked **heuristic** read code as text and can be wrong either way: the page says so.

| Rule               | Possible risk                               | Fires when                                                                                                       | Stays silent when                                                            |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| AV-R01             | Single database, no replica or backup       | one database component and no replica, standby, backup tool or managed-database service in the files             | two databases, a replica service, a managed-database dependency              |
| AV-R02 (heuristic) | Cache entries with no expiry                | a Redis `set`/`hset` without `EX`, `PX`, `ttl` or a following `expire`                                           | `set(k, v, "EX", 60)`, `setex`, a `Map.set`                                  |
| AV-R03 (heuristic) | No rate limiting on a public API            | an app with public routes (including Next.js route handlers) and no limiter package, helper or nginx `limit_req` | any limiter present, a helper called `checkRateLimit`, a `rate-limit` folder |
| AV-R04 (heuristic) | Outside call with no timeout                | `fetch`/`axios` to an outside host without `AbortSignal.timeout`, `signal` or `timeout`                          | a timeout is set; calls to localhost or internal service names               |
| AV-R05 (heuristic) | Database query inside a loop (N+1)          | an awaited ORM/SQL call inside `for`, `while`, `.forEach(async`, `.map(async`                                    | one batched query; a loop awaiting something else                            |
| AV-R06 (heuristic) | Slow work during the request                | email, SMS, file/image processing or payment webhooks in a route handler and **no queue** in the model           | a queue exists; the work is in a worker                                      |
| AV-R07             | Secret-looking variable sent to the browser | names like `NEXT_PUBLIC_..._SECRET`/`KEY`/`TOKEN` (names only)                                                   | `PUBLISHABLE`, `ANON`, `SITE_KEY` names, which are public by design          |
| AV-R08 (heuristic) | No health check endpoint                    | an app with routes and no `/health`, `/healthz`, `/ready` route or file                                          | one exists                                                                   |
| AV-R09 (heuristic) | Serverless functions straight to Postgres   | a Vercel/Netlify/Cloudflare file beside a Postgres client and no pooler marker                                   | the host folder has no database client, or a pooler is present               |
| AV-R10             | Data service exposed in compose             | a database/cache/queue port published on all interfaces, or Redis with no password                               | ports bound to `127.0.0.1`, password set                                     |

Severity is only `info` or `warn`. After the script runs, the agent may add risks from its own reading (`source: "agent"`), but each needs a file and line as evidence. Details, false positives and trade-offs for each rule: `references/risks.md`.

## 6. The page

One HTML file, about 50 to 75 KB, with inline styles and script. It makes **no network requests at all** (no CDN, web fonts, remote icons or analytics) and works from `file://`.

- **Diagram:** one column per tier, components stacked in the column, connections drawn as curves. A connection that skips a column is routed through the gaps, so a line never passes behind a box and looks connected to it. Dashed means inferred. An orange number on a box is the count of possible risks that name it.
- **Side panel:** click a component or connection to see its role, technology, evidence (`file:line`), connections and risks. A **Risks** tab lists every risk; a **Flow** tab lists the steps of the selected flow.
- **Request animation:** pick a flow, then Play, Pause, Step, Back, Restart and a speed menu (0.5x, 1x, 2x). A filled dot is a request, a hollow ring is a response travelling back, a caption names each step, events flash their component, and components outside the flow fade. The animation logic is a small pure block of code that is tested separately.
- **Reduced motion:** if the system asks for it, nothing moves by itself. Step jumps instantly. Play is labelled "Play (uses motion)" and is your explicit choice.
- **Also:** pan and zoom (mouse, buttons, keyboard), light and dark themes (system default plus a button), keyboard focus on components, and on a phone the diagram becomes a list of components.

## 7. Safety guarantees and how they are tested

| Guarantee                                  | How it is enforced                                                                                   | Test                                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Never runs or imports your code            | scripts only read text; no `child_process`, `eval`, `require` or network APIs in any script          | a test scans every script for those words                                                                                            |
| Never reads secrets                        | secret-named files are skipped by name and counted; env example files give names only                | a "canary" test plants `CANARY-SECRET-DO-NOT-READ` in `.env`, `.env.local`, `.pem` and checks it appears in no output, model or page |
| No secret in the model                     | the checker rejects credential-looking strings and never echoes them                                 | model-check tests                                                                                                                    |
| Hostile project text cannot break the page | model text is embedded with `<`, `>`, `&` escaped and shown only as text; the page never writes HTML | an escaping test renders a label containing `</script><img onerror=...>` and checks nothing executes                                 |
| The page is offline                        | no remote URLs, no network APIs                                                                      | an offline test scans the page and the viewer code                                                                                   |
| Repeatable                                 | sorted output, no timestamps                                                                         | determinism tests run each script twice                                                                                              |
| Bounded                                    | 2,000 files, 2 MB per file, 40 output lines                                                          | cap tests                                                                                                                            |
| Safe to start from a symlink               | scripts start through `realpathSync`                                                                 | symlink tests                                                                                                                        |
| Security audit                             | the repo's own `aisle audit` finds no critical or high issue (grade A)                               | an audit test                                                                                                                        |

There are 132 tests for this skill in `registry/skill-tests/arch-visualize.test.ts`, including a real-browser check that no connection passes behind an unrelated component.

## 8. Folder map

```
registry/official/arch-visualize/
├─ SKILL.src.md / SKILL.md   the agent's instructions (SKILL.md is generated; never edit it)
├─ skill.meta.yaml           version 0.1.0, niche arch, quality skill, permissions, demo link
├─ README.md                 short overview and the dogfooding findings (not installed)
├─ references/               model-schema, discovery, flows, risks, viewer
├─ scripts/                  _lib, discover, model-check, risk-check, render
├─ assets/                   viewer.html, tech-catalog.json, model.schema.json, icons/ (+ NOTICE.md)
├─ evals/                    fixture-app, expected.json, fixture/hostile models, demo/ (not installed)
└─ preview/                  screenshots for the store page (not installed)
```

The installer copies only what the skill needs: `SKILL.md`, `references/`, `scripts/`, `assets/`. It never installs `evals/`, `preview/`, `README.md` or `SKILL.src.md`.

## 9. The website demo

The skill page (`/skills/arch-visualize`) has screenshots of the page the skill writes for a small fixture app and an **Open the live demo** link. That link opens the page generated for a real project, DevPath (about 12 components, 4 flows, 4 possible risks). The model for it is `evals/demo/devpath.architecture.json`; the web build renders it with the skill's own `render.mjs` into `/demos/arch-visualize/devpath.html`, so the demo always uses the current viewer.

## 10. What the dogfood run found

The skill was followed by hand on a real project (read-only, no `.env` opened). It first showed about half the components. Fixes, each with a test: missing catalog entries (AI providers, GitHub, ~25 more services, env-name detection), unknown compose images now kept as generic components, in-process auth library folded into its app, AV-R03 and AV-R08 judged per app that owns the routes and aware of a project's own rate-limit helper, and connections routed around boxes. Still found only by reading: a separate WebSocket server and a compose file that mounts the Docker socket into the app (added as an agent-written risk in the demo).

## 11. Limits (0.1.0)

- Shows how requests would travel **according to the code**, not real traffic. Real traces are a planned later version.
- Code rules read JavaScript and TypeScript only. Python and Go projects get components and the compose rules but not the code rules.
- Not covered yet: Kubernetes, Terraform, cloud accounts.
- Rules are heuristics: they can miss risks and can flag things that are fine (for example limits set at a gateway the files do not show).
- Because env **values** are never read, a pooled database host that only appears in a value is invisible to AV-R09.
- A big system shrinks to fit the screen; zoom and Fit are in the page.
- The flows and labels are written by the agent from its reading, so they are only as good as that reading. Evidence on every item lets you check.
- No measured eval numbers exist; the store page shows screenshots only.

## 12. Testing it yourself: a checklist

1. **Install** in a project that has at least an app plus a database or cache: `npx @agentsaisle/cli add arch-visualize` (the installer runs a security audit first). Use a throwaway copy if you prefer.
2. **Run** `/arch-visualize` in a fresh Claude Code session in that project. It is started on purpose; it will not run by itself.
3. **While it runs**, check that it: runs `discover.mjs` first, reads only a handful of files, does not open any `.env` file, and runs `model-check.mjs` until it passes.
4. **Open** `docs/architecture.html` in a browser (also try with Wi-Fi off). Check:
   - every real component is there; nothing invented (dashed means it said "inferred");
   - click a few components: is the evidence (`file:line`) real? Open the file and see;
   - Play each flow: does the request path match how the code really works? Watch the response ring on the way back;
   - Step and Back work; Pause freezes the dot;
   - the Risks tab: does each risk make sense? Remember they are things to check, not verdicts;
   - dark mode, phone width (shrink the window), keyboard (Tab to a component, Enter);
   - turn on "reduce motion" in your system settings: nothing should move until you press Step.
5. **Privacy check:** search `docs/architecture.json` and the page for any real key, password or connection string. There should be none (only variable names).
6. **Run it again** on the same project: it should update the existing model rather than start over, and `risk-check` should not duplicate risks.
7. **Report problems** with: the project's stack, what was missing or wrong, the step it happened in, and the contents of `docs/architecture.draft.json` (it has no secrets). Missing technologies are one-line catalog additions in `assets/tech-catalog.json`.

## 13. Where to read more

- Full spec of the build: `ARCH_VISUALIZE_BRIEF.md` (private, not in git).
- Skill instructions: `registry/official/arch-visualize/SKILL.md` and `references/`.
- The risks in depth: `registry/official/arch-visualize/references/risks.md`.
- Tests: `registry/skill-tests/arch-visualize.test.ts`.
