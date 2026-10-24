# Agent Aisle audit (GitHub Action)

Audits Agent Skills in your repository for risky patterns and shows the findings in your repository's
**Security > Code scanning** tab. It runs [`aisle audit`](https://agentsaisle-vercel.vercel.app/audit) on your
files as text. **Nothing in your skills is run, imported or installed.**

> Automated checks found no known risky patterns. This is not a guarantee of safety.

## Use it

```yaml
name: Aisle audit
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
  security-events: write
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: HazemSalah29/aisle-audit-action@v1
        with:
          fail-on: high
```

Code scanning is free for public repositories. Private repositories need GitHub Code Security.
Without it, set `upload: "false"` and the Action only fails the job and writes a job summary.

## Inputs

| Input         | Default       | What it does                                                                         |
| ------------- | ------------- | ------------------------------------------------------------------------------------ |
| `path`        | `.`           | A skill folder, or a folder with several skills (found up to five levels down).      |
| `fail-on`     | `high`        | `critical`, `high`, `medium`, `low` or `none`. Findings at or above it fail the job. |
| `category`    | `aisle-audit` | SARIF category, to keep several audits apart.                                        |
| `cli-version` | pinned        | The `@agentsaisle/cli` version to run. The Action never floats to a newer one.       |
| `upload`      | `true`        | Upload the SARIF file to code scanning.                                              |

## Outputs

`grades` (for example `my-skill:A,other:C`), `exit-code` (0 clean, 1 findings at or above `fail-on`,
2 the audit could not run) and `sarif-file`.

## Explaining an intentional pattern

Add `.aisleaudit.yaml` inside the skill. Each entry needs a reason of at least 15 characters; suppressed
findings are still listed. Critical findings cannot be suppressed by the author.

```yaml
ignore:
  - rule: AA-N01
    path: references/legacy-api.md
    reason: Documents an old HTTP-only endpoint; no requests are made.
```

## Add the badge

Every skill in the Agent Aisle registry has a badge at `/badges/<name>.json`; the skill page shows the Markdown.

## Security notes

- Inputs reach the script through environment variables, never inside the script text.
- The CLI version is pinned by default. Upgrade it on purpose.
- Pin the Action itself to a release tag (or a commit) in your workflow.
- The workflow needs `security-events: write` only to upload findings.

MIT licensed.
