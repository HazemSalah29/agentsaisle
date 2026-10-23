# Agent Aisle

A store for [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview): folders with a `SKILL.md` that teach an agent one job, used by Claude Code, Codex, Cursor and others.

Agent Aisle has three parts:

- **Website** (`apps/web`): browse, search and read about skills, ours and the community's. Every skill page has a one-line install command. There is also a profile picker that builds a bundle of skills for you, and a form for listing your own.
- **CLI** (`packages/cli`): `npx @agentsaisle/cli add <skill>` installs a skill into your project's skills folder.
- **Registry** (`registry/`): a versioned list of every skill, with where its files live, its metadata and its pinned commit. It compiles to `registry.json`, which the site and the CLI both read.

## Install a skill

You need Node.js 20 or newer.

```sh
npx @agentsaisle/cli add explore
```

Or install the CLI once and use the short name `aisle`:

```sh
npm i -g @agentsaisle/cli
aisle add explore
aisle add explore@1.0.0      # a specific version
aisle add plan implement review
aisle init --profile code    # a starter bundle
```

| Command                                 | What it does                                       |
| --------------------------------------- | -------------------------------------------------- |
| `aisle add <name>[@version] ...`        | Install skills (latest unless you pin a version)   |
| `aisle add <owner>/<repo>[/path][@ref]` | Install straight from any GitHub repo (unverified) |
| `aisle remove <name>`                   | Delete a skill and its lockfile entry              |
| `aisle list`                            | Show installed skills and whether updates exist    |
| `aisle info <name>`                     | Description, author, versions and warnings         |
| `aisle init [--profile <id>]`           | Install a starter bundle                           |

Flags for `add`, `remove`, `list`, `init` and `update`: `--global` (user-level folder), `--agent <claude-code|codex|cursor>`, `--yes` (skip prompts), `--dry-run`. Skills land in `.claude/skills/<name>/` for Claude Code, and installs are recorded in `aisle-lock.json`.

### Why not `npm install`?

`npm install` puts packages in `node_modules`, which agents don't read. The CLI puts the skill folder where your agent looks for it.

## How installs stay safe

- Every version is pinned to a full commit SHA, so a later push to the author's repository can't change what you install.
- The CLI downloads and copies files. It never runs anything from a skill.
- Skills with a `scripts/` folder show the file list and ask before installing.
- **Verified** means a maintainer read the skill and any scripts in full. Community skills are unverified until then and labeled that way.

## Add your skill

Skills are listed with a pull request that adds one YAML file to `registry/community/`. The easiest way is the form at **/submit** on the website, which writes the entry and opens the pull request for you. An automatic check validates your repository, commit, `SKILL.md` and scripts. Only maintainers set `verified`.

## Repository layout

```
apps/web/                  Next.js site (App Router, Tailwind)
packages/cli/              the `aisle` command (published as @agentsaisle/cli)
packages/registry-schema/  zod schemas and types shared by the site, CLI and CI
registry/official/         our skills (SKILL.md + skill.meta.yaml)
registry/community/        one YAML entry per community skill
registry/profiles.yaml     starter bundles and the picker's questions
registry/build.ts          compiles everything into registry/dist/registry.json
```

## Development

Requires Node.js 20+ and [pnpm](https://pnpm.io) 10.

```sh
pnpm install
pnpm build                                  # registry, packages and site
pnpm test                                   # unit tests
pnpm lint && pnpm typecheck
pnpm --filter @agentsaisle/web dev          # site at http://localhost:3000
pnpm --filter @agentsaisle/web test:e2e     # browser smoke tests (after pnpm build)
```

Copy `.env.example` to `.env.local` for optional settings: `GITHUB_TOKEN` raises GitHub API limits and enables star counts; `SITE_URL` sets the public address used for the sitemap and social images. Neither is required.

To try the CLI against your local registry:

```sh
pnpm registry:build
AISLE_REGISTRY=registry/dist/registry.json node packages/cli/dist/index.js add explore --dry-run
```

## Deploying

The site deploys to Vercel from this repository (root directory `apps/web`, build settings in `apps/web/vercel.json`). A push to `main` redeploys it, which republishes `/registry.json`. Official skill versions are pinned to git tags named `<name>@<version>`; push the tag before the registry build runs, or the build fails on purpose.

The CLI is published to npm as `@agentsaisle/cli` from `packages/cli`.

## License

[MIT](LICENSE)
