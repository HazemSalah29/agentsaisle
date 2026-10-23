# Agent Aisle — Build Brief for Claude Code

## How to use this file

1. Create an empty folder, run `git init`, and put this file in it as `BUILD_BRIEF.md`.
2. Open Claude Code in that folder and install the design skill (one time):
   ```
   /plugin marketplace add anthropics/claude-code
   /plugin install frontend-design@claude-code-plugins
   ```
   It activates automatically on UI work. Check it's enabled with `/plugin`.
3. Paste this as your first message:
   > Read BUILD_BRIEF.md fully. Then create CLAUDE.md summarizing the rules, stack and layout from it. Then start Milestone 1 only. Use plan mode: show me the plan before writing code.
4. After each milestone, review it, commit, then say: "Start Milestone N."

Work one milestone at a time. Don't ask Claude Code to build everything in one go.

---

## 1. What we are building

**Agent Aisle** is a store for Agent Skills (SKILL.md folders used by Claude Code, Codex, Cursor and other agents). It has three parts:

1. **Website** — browse, search and read about skills, both our own and community skills hosted on GitHub. Every skill page shows a one-line install command.
2. **CLI** — `npx @agentsaisle/cli add <skill>` or `npx @agentsaisle/cli add <skill>@<version>` installs a skill into the current project's skills folder.
3. **Registry** — a versioned list of every skill: where its files live (repo, path, git ref), its metadata and its pinned commit.

## 2. Tech stack (fixed — do not substitute)

- **Monorepo:** pnpm workspaces + Turborepo
- **Website:** Next.js (App Router, latest stable), React, TypeScript (strict), Tailwind CSS
- **CLI:** Node.js + TypeScript, bundled with `tsup`; `commander` for commands, `@clack/prompts` for interactive prompts, `tar` for extracting archives
- **Validation:** `zod` schemas shared by the website, CLI and CI
- **Testing:** Vitest for packages, Playwright for a few website smoke tests
- **Hosting:** Vercel for the website at agentaisle.dev; npm for the CLI; GitHub for the registry and our skills

## 3. Repo layout

```
agent-aisle/
├── apps/
│   └── web/                     # Next.js site
├── packages/
│   ├── cli/                     # the `aisle` command
│   └── registry-schema/         # zod schemas + types shared by all
├── registry/
│   ├── official/                # our skills, one folder each (SKILL.md + skill.meta.yaml)
│   ├── community/               # one YAML entry per community skill (pointer to GitHub)
│   └── build.ts                 # compiles everything into dist/registry.json
├── .github/workflows/           # CI: validate registry, test, publish
├── BUILD_BRIEF.md
└── CLAUDE.md
```

## 4. Registry data model

Define these in `packages/registry-schema` with zod and export the TypeScript types.

**Community entry** (`registry/community/<name>.yaml`):

```yaml
name: reel-scriptwriter            # unique, lowercase, kebab-case, matches SKILL.md name
author: github-username
repo: someuser/their-skills-repo
path: skills/reel-scriptwriter     # folder containing SKILL.md
versions:
  - version: 1.1.0
    ref: v1.1.0                    # tag or branch it was taken from
    sha: 3f9c2e1...                # full commit SHA; this is what actually gets installed
  - version: 1.0.0
    ref: v1.0.0
    sha: a81b77d...
category: [video, social]
clients: [claude-code, codex, cursor]
runs_scripts: false
verified: false                    # set true only after our review
```

**Official skills** live directly in `registry/official/<name>/` with a `skill.meta.yaml` (version, category, clients, runs_scripts, measured token numbers if available). Versions come from git tags named `<name>@<version>`.

**`registry/build.ts`** reads both, validates every entry, fetches each community SKILL.md at its pinned SHA to read `name` and `description`, and writes `dist/registry.json`:

```ts
type RegistryIndex = {
  generatedAt: string;
  skills: Array<{
    name: string;
    description: string;
    source: "official" | "community";
    author: string;
    repo: string;
    path: string;
    latest: string;
    versions: { version: string; sha: string }[];
    category: string[];
    clients: string[];
    runsScripts: boolean;
    verified: boolean;
  }>;
};
```

`registry.json` is published as a static file on the website (`/registry.json`) and is the single source of truth for both the site and the CLI.

## 5. CLI specification

**Package:** publish as a scoped package, e.g. `@agentsaisle/cli`, with `"bin": { "aisle": "dist/index.js" }`. Before publishing, check the scope and name are free with `npm view <name>`. The `@agentsaisle` npm organization is already created and owns this scope; publish under it.

Users run it without installing: `npx @agentsaisle/cli add explore`. Once installed globally (`npm i -g @agentsaisle/cli`) it's just `aisle add explore`.

Note: we deliberately do **not** use `npm install <skill>`. `npm install` installs npm packages into `node_modules`, which agents don't read. Our CLI installs skill folders where agents look for them.

**Commands**

| Command | What it does |
| --- | --- |
| `aisle add <name>[@version] [...more]` | Install one or more skills into the project |
| `aisle add <owner>/<repo>[/path][@ref]` | Install straight from any GitHub repo, even if not in the registry (show a warning: unverified) |
| `aisle remove <name>` | Delete the skill folder and its lockfile entry |
| `aisle list` | Show installed skills, versions and whether updates exist |
| `aisle search <query>` | Search the registry by name, description, category |
| `aisle update [name]` | Update one or all skills to latest, respecting the lockfile |
| `aisle info <name>` | Description, author, versions, clients, scripts warning |
| `aisle init` | Interactive: pick a profile (code / media / writing) and install its starter bundle |

**Flags:** `--global` (install to the user-level folder instead of the project), `--agent <claude-code|codex|cursor>` (choose target folder; default: detect from project, fall back to claude-code), `--yes` (skip prompts), `--dry-run`.

**Install locations**

- Claude Code: project `.claude/skills/<name>/`, global `~/.claude/skills/<name>/`
- Other agents: put the paths in one config map in the code; verify each against that tool's current docs before release and leave a `TODO(verify)` comment where unsure.

**Install algorithm**

1. Fetch `registry.json` (cache it for 10 minutes in the OS cache folder).
2. Resolve `name@version` to a commit SHA. No version means latest. Unknown name or version: print close matches and exit with code 1.
3. Download `https://codeload.github.com/<repo>/tar.gz/<sha>`, extract only `<path>/` into a temp folder.
4. Validate: SKILL.md exists, frontmatter parses, `name` matches. Fail loudly otherwise.
5. If the skill contains a `scripts/` folder or `runs_scripts: true`, print a clear warning listing the files and ask for confirmation (skipped with `--yes`).
6. If the target folder exists, ask before overwriting.
7. Move the folder into place. **Never execute anything from the downloaded skill during install.**
8. Write or update `aisle-lock.json` in the project root: `{ name, version, repo, path, sha, installedAt }` per skill.
9. Print what was installed, where, and the slash command to try (`/explore`).

**Quality bar:** works on macOS, Linux and Windows (use `path` and `os.homedir()`, no shell commands); clear error messages; exit codes; unit tests for resolving, extracting and the lockfile; an end-to-end test that installs a real skill into a temp folder.

## 6. Website specification

**Pages**

- `/` — Home: what Agent Aisle is, a search bar, featured official skills, newest community skills, the profile picker teaser, the install command.
- `/skills` — Catalog: search, filters (category, client, official/community, verified, runs scripts), sort (popular, newest, name).
- `/skills/[name]` — Skill page: name, description, author with GitHub link, install command with copy button and a version selector that updates the command, supported clients, a "runs scripts" warning if relevant, the rendered SKILL.md (fetched at its pinned SHA), version history, link to the source on GitHub.
- `/profiles` — The picker: answer 3–6 questions, get a bundle and one command (`aisle add plan implement explore review ...`).
- `/submit` — How to list your skill: requirements, the YAML entry format, a form that generates the YAML for you, and a link to open a PR.
- `/docs` — Installing the CLI, all commands, what skills are, how to write a good one.

**Data:** pages are statically generated from `registry.json` at build time with Incremental Static Regeneration (revalidate hourly). GitHub stars and last-updated dates are fetched at build time using a `GITHUB_TOKEN` env var; if the token is missing or rate-limited, the site still builds without those numbers. Search runs client-side over the index (it's small). Render SKILL.md with `react-markdown` + `rehype-sanitize`; never render raw HTML from community content.

**SEO and basics:** metadata and Open Graph images per skill page, `sitemap.xml`, responsive down to 360 px, keyboard accessible, WCAG AA contrast, light and dark themes, Lighthouse ≥ 90 on all four scores.

## 7. Design direction (read before any UI work)

**Updated after the owner chose a new direction in Milestone 3.** The original concept (a grocery aisle: paper, labels, receipt) was replaced by a technical "HUD" system modeled on the structure of getartcraft.com/apps, changed up so it is its own thing. Do not copy that site's assets, logo or copy.

- **Structure.** A sticky 48px header made of hairline-divided cells with an inverted hover. Sharp corners and 1px hairlines everywhere; no shadows or rounded cards. Numbered sections written as "Aisle 01", a nod to the product name. Content sits in a 1200px column with hairline side borders.
- **Color.** Warm-gray light theme and a warm near-black dark theme. One base accent, signal orange (`#EE4F12` light, `#FF5A1F` dark), used for the official badge, the copy confirmation, focus rings and key links. Each aisle (code, design, git, writing, video) has its own text-safe ink color. Tokens live in `apps/web/app/globals.css`; `tokens.test.ts` enforces WCAG AA for every pair in both themes.
- **Type.** Archivo for headings (weight 500, tight tracking), Instrument Serif italic for a single headline phrase, IBM Plex Sans for body text, Geist Mono for commands and small uppercase labels (labels, nav and badges only, never headings or body).
- **Components.** Header and footer, Section, SkillCard (generated preview plate, glyph, name, description, trust badges, client tags), Badge (Official, Verified, Unverified, Runs scripts; each differs in shape or fill, not just color), InstallCommand (terminal bar with version selector and copy button), FilterBar, and Receipt (the bundle shown as a mono ledger with the install command as its total). `/design` shows all of them.
- **Motion.** Only on user action: the copy button changes to "Copied", a newly added bundle line flashes. Both are disabled by `prefers-reduced-motion`.

**Avoid:** purple-to-blue gradients, glassmorphism, generic three-feature-card heroes, emoji as icons, stock illustrations, centered-everything layouts.

## 8. Community submissions and safety

- Submissions are pull requests that add one YAML file to `registry/community/`.
- CI on every PR: validate against the zod schema, check the repo and SHA exist, fetch the SKILL.md at that SHA and validate its frontmatter, flag any `scripts/` folder, check the name is unique.
- Only maintainers set `verified: true`, after reading the skill (and any scripts) in full.
- Versions are pinned to commit SHAs, so a later push to the author's repo can't change what users install.
- The website labels unverified and script-running skills clearly.
- Add a `/report` link on every skill page (opens a GitHub issue template).

## 9. Milestones

Do these in order. Each ends with something that works. Stop after each one and summarize what was built, what was tested and anything I need to decide.

**Milestone 1 — Foundation.** Monorepo, Next.js app, CLI package, schema package, linting, formatting, Vitest, CI running lint + tests. Two official skills in `registry/official/` (`explore`, `commit`) and one test community entry. `registry/build.ts` producing `dist/registry.json`.
*Done when:* `pnpm build` and `pnpm test` pass, and `registry.json` contains 3 valid skills.

**Milestone 2 — CLI core.** `add`, `remove`, `list`, `info`, lockfile, versions, warnings, `--global`, `--dry-run`. Point the CLI at a local `registry.json` via an env var during development.
*Done when:* `pnpm --filter cli dev add explore@1.0.0` installs the skill into a test project's `.claude/skills/explore/`, writes the lockfile, and the E2E test passes.

**Milestone 3 — Design system.** Tokens, fonts, core components following section 7, plus a `/design` page showing them all. No real pages yet.
*Done when:* I've approved the look.

**Milestone 4 — Website pages.** Home, catalog, skill page, docs, reading from `registry.json`.
*Done when:* all pages render on mobile and desktop, search and filters work, the copy button copies the right command for the selected version, Playwright smoke tests pass.

**Milestone 5 — Profiles and submit.** The picker with the receipt, `aisle init`, the submit page with the YAML generator, and the PR validation workflow.
*Done when:* a test PR with a bad entry fails CI with a clear message and a good one passes.

**Milestone 6 — Ship.** Deploy the site to Vercel, publish the CLI to npm (dry run first; ask me before the real publish), README with install instructions.
*Done when:* `npx @agentsaisle/cli add explore` works on a clean machine against the live registry.

## 10. Rules for Claude Code while working

- Use plan mode at the start of each milestone and wait for my approval.
- Keep commits small, one logical change each, with clear messages.
- Write tests alongside code, not at the end.
- Don't add dependencies beyond the stack without asking.
- Never put secrets in code; use `.env.local` and document variables in `.env.example`.
- Never execute code from downloaded skills, in the CLI or in CI.
- Ask me before: publishing to npm, deploying, changing the stack, or deleting files you didn't create.
- If something in this brief turns out to be wrong (a path, a flag, an API), say so and propose a fix instead of working around it silently.
