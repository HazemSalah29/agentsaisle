<div align="center">

# Agent Aisle

**A store for Agent Skills.** Find a skill, install it with one command, and your AI coding agent knows a new job.

[Website](https://agentsaisle-vercel.vercel.app) · [Docs](https://agentsaisle-vercel.vercel.app/docs) · [Browse skills](https://agentsaisle-vercel.vercel.app/skills) · [Add your skill](https://agentsaisle-vercel.vercel.app/submit)

</div>

![The Agent Aisle home page: a search box, an install command and featured skills](docs/images/home.png)

---

## Contents

1. [What is this?](#1-what-is-this)
2. [Quick start (2 minutes)](#2-quick-start-2-minutes)
3. [Using the website](#3-using-the-website)
4. [Using the CLI](#4-using-the-cli)
5. [Kits and aisles](#5-kits-and-aisles)
6. [How installs stay safe](#6-how-installs-stay-safe)
7. [Publish your own skill](#7-publish-your-own-skill)
8. [How it works inside](#8-how-it-works-inside)
9. [Contributing and development](#9-contributing-and-development)
10. [Troubleshooting](#10-troubleshooting)
11. [Glossary](#11-glossary)
12. [License](#12-license)

---

## 1. What is this?

### The problem

AI coding agents (Claude Code, Codex, Cursor and others) are general helpers. They do a better job when you give them **clear instructions for one specific task**, for example "how to write a good commit message" or "how to check a database migration for risky changes".

### What is a skill?

A **skill** is a folder that contains a file called `SKILL.md`. That file starts with a name and a description, then explains to the agent how to do one job. The agent reads the description to decide when the skill applies, and only then loads the rest.

```text
.claude/skills/
└── commit/
    └── SKILL.md      <- the instructions
```

```markdown
---
name: commit
description: Write a clear git commit for the current changes. Use when asked to commit.
---

1. Run git status and git diff.
2. Group the changes into logical commits.
3. Write a short imperative subject and explain why in the body.
```

Some skills also carry small helper scripts or reference files, but the idea stays the same: **a folder of instructions your agent can use.**

### What does Agent Aisle add?

Skills live in many GitHub repositories. Agent Aisle gives you one place to find, compare and install them.

| Part         | Where it lives | What it does                                                                   |
| ------------ | -------------- | ------------------------------------------------------------------------------ |
| **Website**  | `apps/web`     | Browse, search and read about skills. Every skill page has an install command. |
| **CLI**      | `packages/cli` | The `aisle` command. It downloads a skill and puts it where your agent looks.  |
| **Registry** | `registry/`    | A versioned list of every skill. The website and the CLI both read it.         |

```mermaid
flowchart LR
    A[Skill authors<br/>GitHub repos] --> B[Registry<br/>registry.json]
    B --> C[Website<br/>browse and search]
    B --> D[CLI<br/>aisle add name]
    D --> E[Your project<br/>.claude/skills/name/]
    E --> F[Your agent<br/>uses the skill]
```

---

## 2. Quick start (2 minutes)

**You need:** [Node.js](https://nodejs.org) version 20 or newer, and a project folder where you use an AI agent.

**Step 1.** Open a terminal in your project folder.

**Step 2.** Install a skill. This needs no setup, `npx` downloads and runs the CLI for you:

```sh
npx @agentsaisle/cli add explore
```

**Step 3.** Check that it worked. You should now have this folder:

```text
your-project/
├── .claude/skills/explore/SKILL.md
└── aisle-lock.json
```

**Step 4.** Open your agent (for example Claude Code) in the project and ask it to do the job. The agent finds the skill by its description and follows it.

> **Want a short command?** Install the CLI once with `npm i -g @agentsaisle/cli`, then type `aisle add explore` instead.

> **Not using Claude Code?** Add `--agent codex` or `--agent cursor`. The CLI also tries to detect your agent from your project files. See [the agent option](#flags-that-work-on-most-commands).

---

## 3. Using the website

### Find a skill

The **Skills** page lists everything. Search by name or by what you want to do, then filter by author, aisle or whether a skill is official.

![The skills catalog with search, filters and skill cards](docs/images/catalog.png)

### Read a skill page

Each skill has its own page. Read it before you install anything.

![A skill page showing the install command, badges, metadata and a scripts warning](docs/images/skill-page.png)

What to look at on a skill page:

| Part                 | What it tells you                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| **Install box**      | The exact command. Click **Copy** and paste it in your terminal.                               |
| **Official badge**   | The skill is made and maintained by us.                                                        |
| **Verified badge**   | A maintainer read the whole skill, including scripts. See [safety](#6-how-installs-stay-safe). |
| **Audit grade**      | A to F from the automated security audit, with the findings and what the skill can use.        |
| **Runs scripts**     | The skill includes script files. The page lists them and links to the source.                  |
| **Metadata table**   | Author, latest version, aisle, which agents it works with, source repository and stars.        |
| **SKILL.md section** | The full text your agent will read. Nothing is hidden.                                         |

### Pick a starter bundle

Not sure where to start? The **Profiles** page asks a few questions about what you build and creates a bundle of skills with one install command.

![The profile picker with questions and a recommended bundle](docs/images/profiles.png)

### Browse by aisle

An **aisle** groups skills by what they are for, such as Database or Testing and debugging. Official skills come first, then verified and community ones.

![The aisles page grouping skills into Baseline, Web design, Frontend, Database, Testing and debugging and Media](docs/images/aisles.png)

---

## 4. Using the CLI

The CLI is called `aisle`. Every command below works with `npx @agentsaisle/cli <command>` if you did not install it globally.

### Commands

| Command                                 | What it does                                                               |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `aisle add <name>[@version] ...`        | Install one or more skills. Without a version you get the latest.          |
| `aisle add <owner>/<repo>[/path][@ref]` | Install from any GitHub repo, even if it is not listed. Marked unverified. |
| `aisle remove <name>`                   | Delete the skill folder and its lockfile entry.                            |
| `aisle list`                            | Show installed skills and whether a newer version exists.                  |
| `aisle info <name>`                     | Show the description, author, versions, supported agents and warnings.     |
| `aisle search <words>`                  | Search the registry. Best match first.                                     |
| `aisle update [name]`                   | Move one or all installed skills to the latest version. Never downgrades.  |
| `aisle init [--profile <id>]`           | Install a starter bundle and add the house rules to `CLAUDE.md`.           |

> **Release note:** `search` and `update` are in the code, but the version of the CLI on npm (0.1.0) does not have them yet. They arrive with the next release. Until then, run them from source (see [Development](#9-contributing-and-development)).

### Flags that work on most commands

| Flag             | What it does                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `--global`, `-g` | Use your user-level skills folder (`~/.claude/skills`) so the skill works in every project.      |
| `--agent <name>` | `claude-code`, `codex` or `cursor`. By default the CLI detects it and falls back to Claude Code. |
| `--yes`, `-y`    | Skip questions. Required when there is no terminal, for example in CI.                           |
| `--dry-run`      | Show what would happen without changing anything. A good way to learn the tool safely.           |

### Where do skills go?

| Agent       | Project folder           | With `--global`     |
| ----------- | ------------------------ | ------------------- |
| Claude Code | `.claude/skills/<name>/` | `~/.claude/skills/` |
| Codex       | `.codex/skills/<name>/`  | `~/.codex/skills/`  |
| Cursor      | `.cursor/skills/<name>/` | `~/.cursor/skills/` |

The paths for Codex and Cursor can change when those tools change. They live in one place in the code and are marked `TODO(verify)` there.

Every install is written to `aisle-lock.json` in your project. It records the exact version and commit you got, so teammates and CI get the same files. **Commit this file to git.**

### Worked examples

**Try before you install.** Add `--dry-run` and nothing changes:

```sh
aisle add explore --dry-run
```

**Install several at once, pinned to a version:**

```sh
aisle add plan implement review commit
aisle add explore@1.0.0
```

**Install a whole starter bundle.** This also adds a short block of working rules to `CLAUDE.md`, between two marker comments. Running it again replaces only that block and never touches the rest of your file:

```sh
aisle init --profile code
```

Use `--no-rules` to skip the rules, or `--rules-only` to skip the skills.

**See what you have and what is out of date:**

```sh
aisle list
```

**Install something that is not in the registry:**

```sh
aisle add some-author/some-repo/skills/their-skill
```

The CLI shows it as **unverified** and asks before it copies anything.

### Why not `npm install`?

`npm install` puts packages inside `node_modules`, which agents do not read. The CLI copies the skill folder to the place your agent actually looks.

---

## 5. Kits and aisles

### Aisles

| Aisle                     | What is on the shelf                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Baseline**              | Core working habits: plan, implement, explore, review, edit, commit, verify, plus code quality, web performance and web security. |
| **Web design**            | Two design kits with real components (below).                                                                                     |
| **Frontend**              | Web performance and related skills.                                                                                               |
| **Database**              | Schema design, migrations, query tuning and seed data.                                                                            |
| **Testing and debugging** | Writing tests, fixing failing tests, reading logs and stack traces.                                                               |
| **Media**                 | Coming later: images and video.                                                                                                   |

### Kits

A **kit** is a bundle of skills made to work together, installed with one command.

| Kit                       | Install                                      | What you get                                                                 |
| ------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| **Clean SaaS site**       | `aisle init --profile clean-saas-site`       | A minimal, fast startup site: 17 components, no animation library.           |
| **Motion portfolio site** | `aisle init --profile motion-portfolio-site` | A dark, animated portfolio: 17 components with smooth scrolling and reveals. |

Both kits also install the checks that keep a site fast, safe and clean (`code-quality`, `web-performance`, `web-security`, `verify`).

A design skill includes a script that copies its components into your project, plus a linter that flags design drift. Here is what the Clean SaaS kit produces:

<p>
  <img src="registry/official/design-clean-saas/preview/01-hero.jpg" alt="Clean SaaS kit: hero section" width="49%">
  <img src="registry/official/design-clean-saas/preview/08-pricing-monthly.jpg" alt="Clean SaaS kit: pricing table" width="49%">
</p>
<p>
  <img src="registry/official/design-motion-portfolio/preview/01-hero.jpg" alt="Motion portfolio kit: hero section" width="49%">
  <img src="registry/official/design-motion-portfolio/preview/03-work-gallery-start.jpg" alt="Motion portfolio kit: work gallery" width="49%">
</p>

### Elsewhere

Great skills exist outside this registry. The **Elsewhere** shelf on an aisle page lists skills by other authors. We link to the author's GitHub page and show their license. We do **not** host or install them.

---

## 6. How installs stay safe

Installing a skill means copying someone else's text (and sometimes scripts) into your project. Agent Aisle is built so that this stays predictable.

1. **Pinned versions.** Every version points at a full commit SHA. If the author pushes new code later, what you install does not change.
2. **No execution.** The CLI only downloads and copies files. It never runs anything from a skill.
3. **Scripts are declared.** If a skill has a `scripts/` folder, the CLI lists the files. Community and unverified skills **ask before installing**. Official skills, whose scripts a maintainer read in full, list them without asking.
4. **Verified means read.** A **Verified** badge means a maintainer read the skill and every script in full. Community skills are unverified until then.
5. **Everything is readable.** The skill page shows the full `SKILL.md`, and the source link goes to the exact files.

6. **Audited.** `aisle audit` scans a skill as text for risky patterns (prompt injection, data exfiltration, dangerous commands, hidden characters) and gives it a grade from A to F. `aisle add` runs it before installing and blocks critical findings. Every skill page shows its audit. An audit reduces risk; it cannot prove a skill safe.

### For skill authors: the audit Action and badge

- **GitHub Action.** `integrations/aisle-audit-action` is a ready-to-copy Action (publish it as `HazemSalah29/aisle-audit-action`). It runs `aisle audit . --format sarif` and uploads the result so findings appear in your repository's Security tab. It needs a published `@agentsaisle/cli` that includes `aisle audit` (0.2.0 or newer).
- **Badge.** Each skill has a shields.io endpoint badge at `/badges/<name>.json`; the skill page shows the Markdown to paste into a README.
- **Formats.** `aisle audit --format pretty|json|sarif|markdown`, with `--fail-on` setting the exit code.

Your agent may run a skill's scripts later, on your machine. So **read the skill page before you install**, especially for unverified skills. See something wrong? Use **Report this skill** on its page or open a GitHub issue.

---

## 7. Publish your own skill

### Write the skill

1. Make a folder named in lowercase kebab-case, for example `my-skill`.
2. Add `SKILL.md` with a name that **matches the folder** and a short description that says what it does and when to use it.
3. Keep it to one job. If you write "and also", split it into two skills.
4. Keep `SKILL.md` short. Put long reference text in other files in the same folder and link to them.
5. Avoid scripts if you can. If you need them, put them in `scripts/`.
6. **Try it yourself** in a clean project before you submit it.

### List it

1. Push your skill to a **public** GitHub repository.
2. Open the [Submit page](https://agentsaisle-vercel.vercel.app/submit). The form writes a small YAML file for you and opens a pull request.
3. An automatic check validates your repository, commit, `SKILL.md` and scripts. It only reads text and never runs your code.
4. A maintainer reviews it. Only maintainers set **Verified**.

The entry is one file in `registry/community/`. This is what one looks like:

```yaml
name: my-skill
author: your-github-name
repo: your-github-name/your-repo
path: skills/my-skill
versions:
  - version: "1.0.0"
    ref: "main"
    sha: "<the full 40-character commit SHA>"
category: [code]
clients: [claude-code]
runs_scripts: false
```

> The exact fields are checked by the schema in `packages/registry-schema`. The Submit form always produces a valid file, so we suggest using it.

---

## 8. How it works inside

You do not need this to use Agent Aisle, but it helps if you want to contribute.

### The registry

The registry is the single source of truth. A build script (`registry/build.ts`) reads:

- `registry/official/<name>/`: our skills, each with `SKILL.md` and `skill.meta.yaml`
- `registry/community/*.yaml`: one pointer file per community skill
- `registry/profiles.yaml`: starter bundles and the picker's questions
- `registry/aisles.yaml`: how skills are grouped into aisles
- `registry/elsewhere.yaml`: other authors' skills that we link to

It checks all of it and writes `registry/dist/registry.json`. The website serves that file at `/registry.json`, and the CLI downloads it (and caches it for 10 minutes).

### Versions

- **Official skills:** versions come from git tags named `<name>@<version>`, for example `db-schema@0.1.0`. The build looks the tag up and records its commit.
- **Community skills:** the author's entry pins a full commit SHA.

### What `aisle add` does

```mermaid
sequenceDiagram
    participant You
    participant CLI as aisle CLI
    participant Reg as registry.json
    participant GH as GitHub
    You->>CLI: aisle add explore
    CLI->>Reg: look up name and version
    Reg-->>CLI: repo, path, pinned commit
    CLI->>GH: download that commit as a tarball
    CLI->>CLI: extract only the skill folder to a temp dir
    CLI->>CLI: check SKILL.md, warn about scripts
    CLI->>You: confirm if needed
    CLI->>CLI: move into .claude/skills/explore/, update aisle-lock.json
```

### Repository layout

```text
apps/web/                  Next.js website (App Router, Tailwind)
packages/cli/              the `aisle` command, published as @agentsaisle/cli
packages/registry-schema/  zod schemas and types shared by the site, CLI and CI
registry/official/         our skills (SKILL.md + skill.meta.yaml)
registry/community/        one YAML entry per community skill
registry/profiles.yaml     starter bundles and the picker's questions
registry/aisles.yaml       aisle groupings
registry/elsewhere.yaml    other authors' skills we link to
registry/build.ts          compiles everything into registry/dist/registry.json
docs/images/               screenshots used in this README
```

### Tech stack

pnpm workspaces and Turborepo, Next.js with TypeScript and Tailwind, Node and `commander` for the CLI, `zod` for validation, Vitest and Playwright for tests, Vercel for hosting.

---

## 9. Contributing and development

### Requirements

Node.js 20 or newer and [pnpm](https://pnpm.io) 10.

### Set up

```sh
git clone https://github.com/HazemSalah29/agentsaisle.git
cd agentsaisle
pnpm install
```

### Everyday commands

```sh
pnpm build                                   # registry, packages and site
pnpm test                                    # unit tests
pnpm lint && pnpm typecheck                  # style and type checks
pnpm --filter @agentsaisle/web dev           # website at http://localhost:3000
pnpm --filter @agentsaisle/web test:e2e      # browser tests (run pnpm build first)
```

### Try the CLI against your local registry

This lets you test changes without touching the live site:

```sh
pnpm registry:build
AISLE_REGISTRY=registry/dist/registry.json node packages/cli/dist/index.js add explore --dry-run
```

### Settings

Copy `.env.example` to `.env.local`. Both values are optional:

| Variable       | Why you might set it                                             |
| -------------- | ---------------------------------------------------------------- |
| `GITHUB_TOKEN` | Raises GitHub API limits and shows star counts. Never commit it. |
| `SITE_URL`     | The public address, used for the sitemap and social images.      |

### Rules of the road

- **Branches:** develop on `stage`. `main` is the deployed branch, changed only through a pull request so CI runs first.
- **Small commits:** one logical change each, with tests next to the code.
- **New official skill:** push its git tag (`<name>@<version>`) **before** the branch builds on Vercel, or the build fails on purpose.
- **Skills follow a house standard:** `SKILL.md` of 150 lines at most with the sections _Use when, Don't use when, Steps, Budget, Output, Done when_. Run `pnpm lint:skills` to check.
- **Original work only:** official skills never copy other authors' code, text or images.
- **No performance claims without measurements.**

### Deploying

The site deploys to Vercel from this repository (root directory `apps/web`, settings in `apps/web/vercel.json`). A push to `main` redeploys it and republishes `/registry.json`. The CLI is published to npm as `@agentsaisle/cli` from `packages/cli`.

---

## 10. Troubleshooting

| What you see                                    | Why, and what to do                                                                                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command not found: aisle`                      | You did not install it globally. Use `npx @agentsaisle/cli ...` or run `npm i -g @agentsaisle/cli`.                                                                        |
| `Unknown command: search` or `update`           | The npm version is 0.1.0. These commands come in the next release.                                                                                                         |
| The skill installed but my agent ignores it     | Restart the agent session. Check the folder is where your agent looks (see [Where do skills go?](#where-do-skills-go)) and that `SKILL.md` has a `name` and `description`. |
| It asks a question and I am in CI               | Add `--yes`. Without a terminal the CLI refuses to guess.                                                                                                                  |
| `Skill not found`                               | Check the spelling on the website. The skill may be a draft that is not on the live site yet.                                                                              |
| A Vercel build fails for a missing tag          | An official skill was added without pushing `<name>@<version>`. Push the tag and redeploy.                                                                                 |
| `ERR_MODULE_NOT_FOUND ... registry-schema/dist` | The shared schema package is not built. Run `pnpm --filter @agentsaisle/registry-schema build`.                                                                            |

---

## 11. Glossary

| Term              | Meaning                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| **Agent**         | An AI coding assistant such as Claude Code, Codex or Cursor.                 |
| **Skill**         | A folder with a `SKILL.md` that teaches an agent one job.                    |
| **Registry**      | The versioned list of all skills (`registry.json`).                          |
| **CLI**           | A program you run in the terminal. Here it is `aisle`.                       |
| **Aisle**         | A group of skills by purpose, like Database or Testing.                      |
| **Kit / profile** | A bundle of skills installed with one command.                               |
| **Official**      | Made and maintained by the Agent Aisle team.                                 |
| **Verified**      | A maintainer read the skill and its scripts in full.                         |
| **Elsewhere**     | Other authors' skills that we link to but do not host.                       |
| **SHA**           | A 40-character ID of an exact git commit. Pinning to it freezes the content. |
| **Lockfile**      | `aisle-lock.json`, the record of exactly which versions you installed.       |

---

## 12. License

[MIT](LICENSE)
