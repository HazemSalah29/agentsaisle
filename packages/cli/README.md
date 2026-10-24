# @agentsaisle/cli

Install [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) into your project with one command. Skills are folders with a `SKILL.md` that teach an agent one job; Claude Code, Codex and Cursor read them from a skills folder.

```sh
npx @agentsaisle/cli add explore
```

Or install it once and use the short name `aisle`:

```sh
npm i -g @agentsaisle/cli
aisle add explore
```

Requires Node.js 20 or newer. Works on macOS, Linux and Windows.

## Commands

| Command                                 | What it does                                       |
| --------------------------------------- | -------------------------------------------------- |
| `aisle add <name>[@version] ...`        | Install one or more skills (latest unless pinned)  |
| `aisle add <owner>/<repo>[/path][@ref]` | Install straight from any GitHub repo (unverified) |
| `aisle remove <name>`                   | Delete a skill and its lockfile entry              |
| `aisle list`                            | Show installed skills and whether updates exist    |
| `aisle info <name>`                     | Description, author, versions, clients, warnings   |
| `aisle search <query>`                  | Search the registry by name, aisle or description  |
| `aisle update [name]`                   | Update one or all skills to the latest version     |
| `aisle init [--profile <id>]`           | Install a starter bundle and add the house rules   |
| `aisle audit <target>`                  | Scan a skill for risky patterns (see below)        |

```sh
aisle add explore@1.0.0              # a specific version
aisle add plan implement review      # several at once
aisle init --profile code            # a starter bundle plus house rules, no questions asked
aisle init --rules-only              # only the house rules block
aisle init --no-rules                # only the starter bundle
aisle add explore --dry-run          # see what would happen
aisle search git                     # find skills
aisle update                         # move installed skills to their latest versions
```

### Flags

For `add`, `remove`, `list`, `init` and `update` (`--profile` is for `init`):

- `--global`, `-g`: use the user-level skills folder instead of the project.
- `--agent <claude-code|codex|cursor>`: choose the target folder. By default the CLI detects it from your project and falls back to `claude-code`.
- `--yes`, `-y`: skip confirmation prompts. Required when there is no terminal, for example in CI.
- `--dry-run`: show what would be installed or removed without changing anything.
- `--force`, `--no-audit` (`add`, `init`, `update`): see "Audit" below.

### Where skills go

| Agent       | Project                  | Global                     |
| ----------- | ------------------------ | -------------------------- |
| Claude Code | `.claude/skills/<name>/` | `~/.claude/skills/<name>/` |
| Codex       | `.codex/skills/<name>/`  | `~/.codex/skills/<name>/`  |
| Cursor      | `.cursor/skills/<name>/` | `~/.cursor/skills/<name>/` |

The Codex and Cursor folders follow each tool's convention at the time of writing; check their current docs if a skill isn't picked up.

`aisle update` only moves forward: it updates a skill when the registry has a newer version, never downgrades, and leaves skills installed straight from GitHub alone.

Installs are recorded in `aisle-lock.json` in your project root (your home folder with `--global`): name, version, repository, path, commit and install time.

## House rules

`aisle init` also writes a short block of working rules into `CLAUDE.md` (`AGENTS.md` for Codex and Cursor; `~/.claude/CLAUDE.md` with `--global` for Claude Code) between `<!-- agent-aisle:start -->` and `<!-- agent-aisle:end -->` markers. Running it again replaces only that block and leaves everything else in the file untouched. A file with damaged markers is left alone and reported.

Development files in a skill (`evals/`, `preview/`, the top-level `README.md`) are not installed.

## Audit

`aisle audit` reads a skill as text and reports risky patterns (prompt injection, data exfiltration, dangerous commands, over-broad permissions, hidden characters). It never runs anything in the skill.

```sh
aisle audit ./my-skill                 # a local folder (or a folder with several skills)
aisle audit explore@1.1.0              # a skill from the registry
aisle audit owner/repo/skills/x@main   # any GitHub repo or folder
aisle audit ./my-skill --format json --output audit.json
aisle audit ./my-skill --fail-on critical
aisle audit . --format sarif --output audit.sarif   # for GitHub's Security tab
aisle audit . --format markdown                     # for a PR comment
```

Options: `--format pretty|json|sarif|markdown`, `--fail-on critical|high|medium|low|none` (default `high`), `--output <file>`, `--quiet`. `--deep` is not available yet. Local paths must start with `./`, `../`, `/` or `~`.

Exit codes: `0` nothing at or above `--fail-on`, `1` findings at or above it, `2` the audit could not run.

`aisle add`, `init` and `update` audit every skill after download and before installing:

- **critical** findings block the install. Override with `--force` and type the skill name when asked; `--yes` never bypasses this, and without a terminal it cannot be done.
- **high** findings show a summary and ask for confirmation (`--yes` answers it).
- Lower findings print one summary line.
- `--no-audit` skips the audit and prints a warning.

Downloads are limited to 20 MB per archive, 2,000 files and 2 MB per file, and refuse absolute paths, `..` and hardlinks. Symlinks are never installed.

To run the audit on every push and see findings in GitHub's Security tab, use the `aisle-audit-action` GitHub Action (`integrations/aisle-audit-action` in the Agent Aisle repository).

Automated checks found no known risky patterns is not a guarantee of safety: an audit reduces risk, it cannot prove a skill safe.

## Safety

- Every registry version is pinned to a full commit SHA, so a later push to the author's repository can't change what you install.
- The CLI downloads and copies files. **It never runs anything from a skill.**
- If a skill has a `scripts/` folder, the CLI lists the files. Community and unverified skills ask before installing (`--yes` skips the question); verified official skills, whose scripts a maintainer read in full, are listed without asking.
- Skills added with `aisle add <owner>/<repo>` and community skills not yet reviewed are shown as unverified.

## Configuration

- `AISLE_REGISTRY`: path or URL of a `registry.json` to use instead of the default (handy for local development).
- The registry is cached for 10 minutes in your operating system's cache folder.

## Links

- Source and issues: https://github.com/HazemSalah29/agentsaisle
- Browse skills and submit your own on the Agent Aisle website.

MIT licensed.
