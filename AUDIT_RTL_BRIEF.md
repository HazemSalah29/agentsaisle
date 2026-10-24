# Agent Aisle — `aisle audit` + `arabic-rtl` Build Brief for Claude Code

## How to use this file

1. Put this file in the root of the `agentsaisle` repo as `AUDIT_RTL_BRIEF.md`.
2. Open a **new** Claude Code session and paste:
   > Read AUDIT_RTL_BRIEF.md fully, then CLAUDE.md. Add a short section to CLAUDE.md summarizing this brief's rules. Then start Milestone A1 only, in plan mode: show me the plan before writing code.
3. One milestone per session. Part A (audit) and Part B (arabic-rtl) are independent; you can alternate. Recommended order: A1 → A2 → B1 → B2 → A3 → B3 → A4.
4. After each milestone: review, test it yourself, commit, open a new session, and say "Read AUDIT_RTL_BRIEF.md and CLAUDE.md, then start Milestone X."

Everything in `BUILD_BRIEF.md` section 10 and `V2_BRIEF.md` section 2 (IP, honesty, house standard) still applies.

---

# Part A — `aisle audit`

## A.1 What it is

A free, open-source security scanner for Agent Skills. It reads a skill folder, local or from GitHub, **without running anything in it**, and reports risky patterns: prompt injection, data exfiltration, dangerous commands, over-broad permissions, hidden characters and structural problems.

It is used in four places:

1. **CLI:** `aisle audit <target>` for anyone, on any skill.
2. **Install guard:** `aisle add` audits every skill before installing it.
3. **Registry CI:** every community submission is audited; results appear on the skill's page.
4. **GitHub Action + badge:** skill authors run it in their own repos (Milestone A4).

**Honesty rule:** an audit reduces risk; it cannot prove a skill safe. Every report, page and post says so in one line: "Automated checks found no known risky patterns. This is not a guarantee of safety."

## A.2 Commands

```
aisle audit <target> [options]

<target>
  ./path/to/skill                 local folder (containing SKILL.md)
  ./path/to/skills-repo           a folder with several skills: audits each
  <name>[@version]                a skill from the Agent Aisle registry
  <owner>/<repo>[/path][@ref]     any GitHub repo or subfolder

Options
  --format pretty|json|sarif|markdown   default: pretty
  --fail-on critical|high|medium|low|none   default: high (sets exit code)
  --deep                AI-assisted review (needs ANTHROPIC_API_KEY); adds findings, never removes them
  --output <file>       write the report to a file
  --quiet               summary line only
```

Exit codes: `0` = nothing at or above `--fail-on`; `1` = findings at or above it; `2` = the audit couldn't run (bad target, download failed, invalid input).

**Install guard in `aisle add`:**
- Runs the audit after download, before moving files into place.
- `critical` findings block install. To proceed anyway: `--force` **and** typing the skill name at a prompt. `--yes` never bypasses a critical block.
- `high` findings show a summary and ask for confirmation (skipped with `--yes`).
- Lower findings print one summary line.
- `--no-audit` skips it, with a visible warning.

## A.3 Architecture

New package `packages/audit/` (TypeScript, no network access of its own, pure functions):

```
packages/audit/
├── src/
│   ├── index.ts            # auditSkill(folder) → Report; auditMany(folder) → Report[]
│   ├── load.ts             # reads files safely (limits, symlink checks), classifies file types
│   ├── rules/
│   │   ├── structure.ts    # AA-S*
│   │   ├── permissions.ts  # AA-P*
│   │   ├── injection.ts    # AA-I*
│   │   ├── exfiltration.ts # AA-X*
│   │   ├── execution.ts    # AA-E*
│   │   ├── network.ts      # AA-N*
│   │   ├── secrets.ts      # AA-K*
│   │   └── unicode.ts      # AA-U*
│   ├── score.ts            # severity counts → grade
│   ├── suppress.ts         # .aisleaudit.yaml handling
│   ├── deep.ts             # optional AI review (A4)
│   └── format/             # pretty, json, sarif, markdown
├── fixtures/
│   ├── benign/             # realistic good skills (should produce no high/critical)
│   └── malicious/          # synthetic bad skills, one per rule (inert payloads)
└── test/
```

- The CLI's existing download-and-extract code feeds `auditSkill` a temp folder. **Harden extraction** at the same time: reject absolute paths, `..` segments and symlinks in archives, and cap archive size (20 MB), file count (2,000) and single-file size (2 MB).
- The `Report` type lives in `packages/registry-schema` (zod) so the website and CI can read stored reports.

```ts
type Finding = {
  rule: string;            // "AA-X02"
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;           // "Script sends environment variables to a remote URL"
  file: string;            // "scripts/sync.sh"
  line?: number;
  excerpt?: string;        // ≤ 160 chars, secrets masked
  why: string;             // one sentence: why this is risky
  fix: string;             // one sentence: what a safe version looks like
  source: "static" | "deep";
  suppressed?: { reason: string };
};

type Report = {
  skill: string; version?: string; sha?: string;
  auditedAt: string; auditVersion: string;
  files: number; bytes: number;
  counts: Record<Finding["severity"], number>;
  grade: "A" | "B" | "C" | "D" | "F";
  findings: Finding[];
  disclaimer: string;
};
```

**Grade:** A = no findings above low; B = medium only; C = 1–2 high; D = 3+ high; F = any critical. Suppressed findings don't count towards the grade but are always listed.

## A.4 Rules (version 1)

Rules use regexes plus light context (which file type, whether the match is in an instruction, a code block or a script). Every rule has at least one malicious fixture that triggers it and one benign fixture that must not.

### Structure (AA-S)

| ID | Severity | Detects |
| --- | --- | --- |
| S01 | high | No `SKILL.md`, or frontmatter missing/invalid |
| S02 | medium | `name` doesn't match folder or spec format; description missing or over 1,024 chars |
| S03 | critical | Symlink anywhere in the skill, or a path escaping the folder |
| S04 | high | Executable binaries or compiled files (ELF, Mach-O, PE, `.so`, `.dll`, `.exe`, `.pyc`, `.jar`) |
| S05 | medium | Minified or obfuscated scripts (very long lines, high entropy) |
| S06 | low | `SKILL.md` over 500 lines; references nested more than one level |
| S07 | low | Hidden files or folders (except `.aisleaudit.yaml`) |

### Permissions (AA-P)

| ID | Severity | Detects |
| --- | --- | --- |
| P01 | high | `allowed-tools` grants unrestricted `Bash` (`Bash`, `Bash(*)`, `Bash(* *)`) |
| P02 | medium | Broad write + shell combination without `disable-model-invocation: true` |
| P03 | high | `hooks` in frontmatter (commands that run automatically on agent events) |
| P04 | high | Commands that run when the skill loads (Claude Code's dynamic context injection, the `` !`command` `` syntax). Verify the current syntax in Claude Code's skills docs. |
| P05 | medium | Unrestricted web fetching combined with file reading |
| P06 | info | Inventory: every tool, script and URL the skill can use (shown as the permissions label) |

### Prompt injection (AA-I), scanned in SKILL.md, references and assets

| ID | Severity | Detects |
| --- | --- | --- |
| I01 | high | Override language: "ignore previous/all instructions", "disregard the system prompt", "you are now", "new instructions:" |
| I02 | high | Concealment: "don't tell/mention/show the user", "silently", "without asking", "hide this" |
| I03 | critical | Instructions to change agent safety: edit `settings.json` permissions, `CLAUDE.md`/`AGENTS.md` outside the skill's stated job, add allow rules, auto-approve, disable confirmations |
| I04 | medium | Instructions hidden in HTML comments, collapsed `<details>`, or alt text |
| I05 | medium | Long base64/hex blobs in instruction files |
| I06 | high | Instructions to fetch and follow remote instructions ("read https://… and do what it says") |

Tune I01–I02 against benign fixtures: a skill *about* prompt injection (like a security-review skill) quotes these phrases in examples. Lower severity when the phrase is inside a fenced code block or a quoted example, and say so in the finding.

### Exfiltration (AA-X)

| ID | Severity | Detects |
| --- | --- | --- |
| X01 | critical | Reading credential stores: `~/.ssh`, `id_rsa`, `~/.aws`, `~/.config/gcloud`, `~/.npmrc`, `~/.netrc`, keychains, browser profile/cookie paths |
| X02 | critical | Environment variables or `.env` contents sent to a network call (`printenv`, `env`, `process.env`, `os.environ` flowing into `curl`, `fetch`, `requests`, etc.) |
| X03 | high | Uploads to paste, webhook or tunnel services (Discord/Slack webhooks, pastebin, ngrok, requestbin-style hosts, raw IP endpoints) |
| X04 | high | Instructions telling the agent to send code, files or conversation content to an external URL |
| X05 | medium | DNS-based exfiltration patterns (`nslookup`/`dig` with interpolated data) |

### Dangerous execution (AA-E)

| ID | Severity | Detects |
| --- | --- | --- |
| E01 | critical | Download-and-run: `curl … \| sh`, `wget … \| bash`, `iex (irm …)`, `eval "$(curl …)"` |
| E02 | critical | Decode-and-run: base64/hex decoded then executed (`base64 -d \| sh`, `eval(atob(…))`, `exec(b64decode(…))`) |
| E03 | high | Destructive commands: `rm -rf` on `/`, `~`, `$HOME` or unbounded variables; `mkfs`; `dd of=/dev/` |
| E04 | high | Persistence: writing to shell rc files, `crontab`, launch agents, systemd units, startup folders |
| E05 | high | Privilege: `sudo`, `chmod 777`, `chown` on system paths |
| E06 | medium | Installing unpinned or remote packages in scripts (`npx <pkg>` without version, `pip install` from URLs or git, `npm install` without lockfile) |
| E07 | medium | Dynamic code execution in scripts (`eval`, `new Function`, `exec`, `subprocess` with `shell=True` on interpolated input) |

### Network (AA-N) and secrets (AA-K)

| ID | Severity | Detects |
| --- | --- | --- |
| N01 | low | Plain `http://` URLs |
| N02 | medium | URL shorteners or raw IP addresses |
| N03 | info | Inventory of every domain referenced (shown on the skill page) |
| K01 | high | Hardcoded secrets in the skill (common key formats: `sk-`, `ghp_`, `AKIA`, private key headers, JWTs); masked in output |

### Hidden characters (AA-U)

| ID | Severity | Detects |
| --- | --- | --- |
| U01 | critical | Unicode tag characters (U+E0000–U+E007F), which can carry invisible instructions |
| U02 | high | Bidirectional control characters (U+202A–U+202E, U+2066–U+2069) in **scripts**, which can make code display differently than it runs ("Trojan Source") |
| U03 | medium | Bidi controls in instruction files outside Arabic/Hebrew text runs |
| U04 | medium | Zero-width characters (U+200B, U+2060, U+FEFF not at file start) inside Latin words or clustered |

**Important for Part B:** Arabic text legitimately uses ZWNJ (U+200C) and ZWJ (U+200D) between Arabic letters, and RTL docs may legitimately show bidi characters. U03/U04 must ignore ZWNJ/ZWJ adjacent to Arabic-script letters (U+0600–U+06FF, U+0750–U+077F, U+08A0–U+08FF, U+FB50–U+FDFF, U+FE70–U+FEFF) and bidi marks inside Arabic text runs. The `arabic-rtl` skill is a required benign fixture: it must get grade A.

## A.5 Suppressions

Authors can explain intentional patterns in `.aisleaudit.yaml` inside the skill:

```yaml
ignore:
  - rule: AA-N01
    path: references/legacy-api.md
    reason: Documents an old HTTP-only endpoint; no requests are made.
```

- Each suppression needs a `reason` (min 15 chars).
- `critical` findings can't be suppressed by authors; only a registry maintainer can mark them reviewed in the registry entry.
- Suppressed findings are always shown in reports and on the skill page, labeled with the reason.

## A.6 Deep mode (AI-assisted, Milestone A4)

- `--deep` sends SKILL.md, references and scripts to the Claude API (key from `ANTHROPIC_API_KEY`; ask me before choosing the model; print the estimated cost first and require `--yes` or a confirmation).
- **The audited content may itself contain prompt injection aimed at the auditor.** Wrap all skill content in nonce-delimited untrusted-data markers, instruct the model to treat it strictly as data, and require a JSON response matching a schema (validated with zod; invalid output = no deep findings plus a warning).
- Deep findings are **added** with `source: "deep"` and a label "AI-assisted, may be wrong". They can never lower or remove a static finding.
- Truncate large skills with a clear note of what wasn't reviewed.

## A.7 Integrations

- **Registry CI** (`.github/workflows/validate-registry.yml`): audit every new or changed community entry at its pinned SHA. Fail the PR on `critical`; post the markdown report as a PR comment. Store each report as `dist/audits/<name>@<version>.json` during the registry build.
- **Website:** an "Audit" block on every skill page with the grade, counts, findings (expandable), the permissions inventory (tools, scripts, domains), audit date and version, and the disclaimer. Grade badge on skill cards in the catalog.
- **`/audit` page:** explains rules and grades, links to the open-source rules, and shows how to run it locally.
- **GitHub Action** (A4): publish `HazemSalah29/aisle-audit-action` (a composite action running `npx @agentsaisle/cli audit . --format sarif --output audit.sarif`, then GitHub's `upload-sarif` action) so findings show in the repo's Security tab.
- **Badge** (A4): the registry build writes shields.io endpoint JSON (`{"schemaVersion":1,"label":"aisle audit","message":"A","color":"brightgreen"}`) per skill at `/badges/<name>.json`.

## A.8 Testing and quality bar

- Write at least one malicious and one benign fixture per rule. Malicious fixtures must be **inert**: URLs use `example.com`/`example.invalid`, commands target fake paths, nothing is runnable as a real attack.
- Run the scanner on every skill in our registry and on the benign fixtures: **zero false criticals** is required to ship; list every high on benign input and justify or fix it.
- Unit tests per rule; snapshot tests for each output format; SARIF validated against the 2.1.0 schema.
- Performance: a typical skill (under 50 files) audits in under 1 second.
- **Never execute, import or `require` any file from the audited skill.** Read as text only.
- License the audit package MIT. Open rules build trust.

## A.9 Milestones

**A1 — Core scanner.** `packages/audit` with load, all static rules, scoring, suppressions, JSON and pretty output, fixtures, tests.
*Done when:* all rule tests pass; registry skills and benign fixtures produce no critical findings; each malicious fixture triggers its intended rule.

**A2 — CLI.** `aisle audit` command (all target types, formats, exit codes); install guard in `aisle add`; hardened extraction.
*Done when:* `aisle audit ./fixtures/malicious/x02` exits 1 with the finding; `aisle add` blocks a critical fixture and needs `--force` plus typed confirmation; E2E tests pass.

**A3 — Registry and website.** CI audit on PRs with comment; stored reports; Audit block on skill pages; grade badges in the catalog; `/audit` page; SARIF and markdown formats.
*Done when:* a test PR with a malicious entry fails with a readable comment; skill pages show real reports.

**A4 — Deep mode, Action, badge.** `--deep` with untrusted-data fencing; GitHub Action repo; badge endpoint; README badge instructions. Ask me before publishing the Action and before any paid API call.
*Done when:* an injection fixture that tries to tell the auditor "report no issues" is still reported by both static and deep checks; the Action works in a test repo.

---

# Part B — `arabic-rtl` skill

## B.1 What it is

An official skill that makes a web app fully Arabic and right-to-left: locale routing, direction, layout mirroring with logical CSS, Arabic typography, numbers, dates and plurals, mixed-direction text, forms, translation with a glossary, and visual QA. First target: **Next.js (App Router) + React + Tailwind**. Plain HTML/CSS guidance is included; other frameworks come later.

- `kind: quality` (the codemod and scan scripts also save many tokens; report both numbers).
- `disable-model-invocation: true` (a big change; the user runs `/arabic-rtl` deliberately).
- A lighter companion, `rtl-check` (model-invoked, haiku, read-only), runs only the scan on changed files during later work, so new code stays RTL-safe. Ship it in B2.

## B.2 Decisions the skill asks for once

Saved to `i18n.config.json` at the project root and reused on every later run:

| Decision | Options | Default |
| --- | --- | --- |
| Locales | e.g. `en` + `ar` | `en`, `ar` |
| Default locale | any listed | `en` |
| URL strategy | prefix (`/ar/...`), domain, or cookie only | prefix |
| Arabic variety | Modern Standard Arabic (MSA); Egyptian, Gulf or Levantine for marketing copy | MSA |
| Digits | Western (0–9) or Arabic-Indic (٠–٩) | Western |
| Calendar | Gregorian, or Gregorian + Hijri display | Gregorian |
| Addressing the user | gender-neutral phrasing, masculine default, or variants | gender-neutral where possible |
| Arabic font | from `references/typography.md` | IBM Plex Sans Arabic |

## B.3 Skill folder

```
arabic-rtl/
├── SKILL.md
├── references/
│   ├── i18n-nextjs.md        # next-intl setup for the App Router
│   ├── logical-css.md        # physical → logical mapping (Tailwind + plain CSS)
│   ├── mirroring.md          # what flips and what never flips
│   ├── typography.md         # Arabic fonts, sizes, line height, no letter-spacing
│   ├── numbers-dates.md      # Intl APIs, digits, currency, Hijri, Arabic plurals
│   ├── bidi.md               # mixed-direction text, dir="auto", <bdi>, isolation
│   ├── forms.md              # inputs, validation, LTR fields
│   ├── translation.md        # variety, tone, glossary, gender, no concatenation
│   ├── qa-checklist.md
│   └── other-frameworks.md   # plain HTML/CSS notes; Vue/Nuxt and React Native later
├── scripts/
│   ├── rtl-scan.mjs          # find RTL problems
│   ├── rtl-codemod.mjs       # physical → logical Tailwind classes (dry run by default)
│   ├── i18n-candidates.mjs   # list hardcoded user-facing strings with key suggestions
│   ├── translate-check.mjs   # compare message files: missing, untranslated, placeholders, plurals
│   └── screenshot-rtl.mjs    # en vs ar screenshots + overflow detection
├── assets/
│   ├── messages/ar.json      # starter UI strings (nav, buttons, forms, errors, auth, pagination)
│   ├── messages/en.json
│   ├── glossary.ar.yaml      # product terms with approved translations
│   ├── fonts.ts              # next/font setup: Arabic + Latin pairing
│   ├── LocaleSwitcher.tsx
│   └── DirectionalIcon.tsx   # flips directional icons in RTL
├── evals/tasks.yaml
├── preview/
├── README.md
└── skill.meta.yaml
```

## B.4 What the references must cover

Write original content; verify library APIs against current official docs and mark anything unverified with `TODO(verify)`.

**`i18n-nextjs.md`**
- next-intl with a `[locale]` route segment, request config, message loading, `NextIntlClientProvider`, server-side `getTranslations`.
- Locale detection and redirects. Check which file the installed Next.js version uses for this (`middleware.ts`, or its renamed successor in newer versions) and follow next-intl's docs for that version.
- `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>` set in the root layout from the locale.
- Static generation for each locale; `hreflang` alternates in metadata.

**`logical-css.md`**
- Full mapping table, Tailwind and CSS. Core examples: `ml-*`→`ms-*`, `mr-*`→`me-*`, `pl-*`→`ps-*`, `pr-*`→`pe-*`, `left-*`→`start-*`, `right-*`→`end-*`, `text-left`→`text-start`, `text-right`→`text-end`, `rounded-l-*`→`rounded-s-*`, `rounded-tl-*`→`rounded-ss-*`, `border-l-*`→`border-s-*`, `scroll-ml-*`→`scroll-ms-*`; CSS `margin-left`→`margin-inline-start`, `left`→`inset-inline-start`, `text-align: left`→`start`.
- Confirm which logical utilities the project's Tailwind version supports (check `package.json`; verify against Tailwind docs for that version, e.g. floats and some border/radius forms). Fall back to `rtl:`/`ltr:` variants where no logical utility exists.
- Things logical properties don't fix: `translate-x-*`, `space-x-*` (use `gap` or `rtl:space-x-reverse`), absolutely positioned decorations, gradients with `to-r`, background positions, and transforms in animations.

**`mirroring.md`**
- **Mirror:** back/forward arrows, chevrons, breadcrumb separators, progress bars, sliders, carousels and their swipe direction, timelines, list bullets/indent, sidebar placement, "next" buttons, text-alignment icons.
- **Never mirror:** logos, brand marks, media play/pause/forward, clocks, checkmarks, slashes in content, numbers, phone numbers, code, charts' numeric axes (unless the chart library supports RTL properly), images of real things, and icons of objects that have a real-world orientation.
- `DirectionalIcon`: wraps an icon and applies `rtl:-scale-x-100` only when `directional` is true.

**`typography.md`**
- Recommended Google Fonts with Arabic support: IBM Plex Sans Arabic, Noto Sans Arabic, Noto Naskh Arabic (long reading), Cairo, Tajawal, Readex Pro, Almarai. Pair with a Latin face of similar weight and x-height.
- **Never apply letter-spacing (tracking) to Arabic:** it breaks the letter connections. Override `tracking-*` to normal under `:lang(ar)`.
- No `uppercase`/`italic` styling for Arabic (neither exists); emphasize with weight or color.
- Line-height around 1.6–1.8 for body; Arabic often reads better slightly larger than Latin at the same nominal size.
- Load only needed weights; use `next/font` with `display: swap` and appropriate subsets.

**`numbers-dates.md`**
- Always use `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` and `Intl.PluralRules` with an explicit locale.
- **Set digits explicitly**, because defaults vary by region and runtime: `ar-EG-u-nu-latn` for Western digits, `ar-EG-u-nu-arab` for Arabic-Indic. Don't rely on the bare `ar` default.
- Currency: `{ style: 'currency', currency: 'EGP' }` (or the product's currency); never hand-build "EGP 100".
- Optional Hijri display via `-u-ca-islamic` variants (verify supported calendar identifiers in the target runtimes).
- **Arabic has six plural categories:** zero, one, two, few, many, other. Messages with counts use ICU plural syntax covering all six.
- Phone numbers, order IDs, codes and prices inside Arabic sentences go in LTR isolates (see `bidi.md`).

**`bidi.md`**
- User-generated content: `dir="auto"` on its container.
- Embedded opposite-direction runs (an English product name, email, URL, code) in `<bdi>` or `unicode-bidi: isolate`.
- Inputs: `dir="auto"` for free text; force `dir="ltr"` for email, URL, password, phone and code fields, with text aligned to the start.
- Punctuation and parentheses issues in mixed strings, and how isolation fixes them.
- Never insert bidi control characters into code; use markup and CSS (this also keeps `aisle audit` clean).

**`forms.md`:** label placement, required markers, error message placement, icons inside inputs (`ps-`/`pe-`), select arrows, date pickers, validation messages translated with placeholders.

**`translation.md`**
- MSA for UI; the chosen dialect only for marketing copy, if selected.
- Use the glossary; never translate brand and product names; keep placeholders (`{name}`) intact.
- **No string concatenation:** whole sentences with placeholders, because word order changes.
- Gender: prefer neutral constructions; when impossible, follow the config choice.
- Expect length changes; never set fixed widths on text containers.
- **Honest limit:** model translation is a draft. The skill writes `translation-review.md` listing strings it's unsure about, and recommends a native speaker review before production.

## B.5 Scripts

All scripts: Node ≥ 18, no network, read-only unless `--write`, output capped at 40 lines plus a count, unit-tested on fixtures.

- **`rtl-scan.mjs`** — reports, with file:line and a suggested fix:
  - physical Tailwind classes, including variants (`md:ml-4`, `hover:pr-2`, `-ml-2`)
  - physical CSS properties in `.css`/`.module.css`/CSS-in-JS
  - `space-x-*` without RTL handling; `translate-x-*` in non-animation contexts
  - hardcoded `dir="ltr"` on layout containers
  - known directional icons (`ArrowLeft`, `ChevronRight`, etc. from common icon sets) not wrapped in `DirectionalIcon`
  - `toLocaleString()` / `toLocaleDateString()` without an explicit locale
  - string concatenation building user-facing text in JSX
  - `letter-spacing`/`tracking-*` applied where Arabic text renders
  - Severity per finding: `error` (breaks RTL) or `warn` (likely issue).
- **`rtl-codemod.mjs`** — rewrites physical Tailwind classes to logical ones using the mapping in `logical-css.md`:
  - handles variants, negatives, important (`!`), and classes in `clsx`/`cn`/`cva` calls and template literals
  - skips classes it can't map safely and lists them for manual review
  - **dry run by default** (prints a diff summary); `--write` applies; never touches `node_modules`, build output or the kit folders of other skills unless asked
  - idempotent: running twice changes nothing the second time
- **`i18n-candidates.mjs`** — lists hardcoded user-facing strings (JSX text, `alt`, `title`, `placeholder`, `aria-label`) with suggested keys (`page.section.element`). The agent does the replacements file by file; the script never rewrites code.
- **`translate-check.mjs`** — compares `messages/en.json` and `messages/ar.json`: missing keys, extra keys, values identical to English (likely untranslated), placeholder mismatches, invalid ICU syntax, plural messages missing Arabic categories, glossary violations.
- **`screenshot-rtl.mjs`** — with Playwright: for each route, screenshots `en` and `ar` at 1440 px and 390 px into `.agent-aisle/rtl-screens/`, and flags horizontal overflow (`scrollWidth > clientWidth`) in `ar`.

## B.6 SKILL.md (draft)

```markdown
---
name: arabic-rtl
description: Add full Arabic and right-to-left support to a web app (Next.js App Router + Tailwind first): locale routing, dir, logical CSS, mirroring, Arabic typography, numbers, dates, plurals, mixed-direction text, forms, translation and visual QA. Use when the user asks to add Arabic, RTL, or localize an app for Arabic speakers. Don't use for translating a single document.
disable-model-invocation: true
model: sonnet
effort: high
allowed-tools: Read Write Edit Glob Grep Bash(node *) Bash(npx playwright *) Bash(pnpm *) Bash(npm run *) Bash(npm install *)
---

# Arabic + RTL

## Use when
- Adding Arabic to an existing app, or making an Arabic-first app RTL-correct.

## Don't use when
- One-off text translation, or apps without a web UI.

## Steps
1. Read `i18n.config.json`. If missing, ask the decisions in README's "Decisions" list (only the ones not answered), then write it.
2. Detect the stack (framework, Next.js and Tailwind versions, existing i18n library). Read only the references you need.
3. Setup (if no i18n yet): follow `references/i18n-nextjs.md`; set `lang` and `dir` on `<html>`; add fonts from `assets/fonts.ts`; add `LocaleSwitcher`.
4. Run `node <skill>/scripts/rtl-codemod.mjs` (dry run). Review the summary, then run with `--write`. Fix the listed unmappable classes by hand.
5. Run `node <skill>/scripts/rtl-scan.mjs`. Fix every `error`; review `warn`s.
6. Mirroring: wrap directional icons with `DirectionalIcon` per `references/mirroring.md`.
7. Strings: run `i18n-candidates.mjs`; move strings to `messages/en.json` file by file; translate into `messages/ar.json` using `assets/glossary.ar.yaml` and `references/translation.md`. Write `translation-review.md` for uncertain strings.
8. Numbers, dates, currency and plurals per `references/numbers-dates.md`; isolate mixed-direction text per `references/bidi.md`; fix forms per `references/forms.md`.
9. Run `translate-check.mjs`, the project's build and checks, then `screenshot-rtl.mjs`. Look at en/ar shots side by side at both widths; fix issues.

## Budget
<!-- include: _shared/read-budget.md -->
- Let scripts find problems; don't read every file looking for physical classes.

## Output
- Config used, files changed (count + notable ones), scan before/after counts, untranslated or uncertain strings, screenshot paths.

## Done when
- rtl-scan: 0 errors. translate-check: passes. Build and project checks pass.
- en/ar screenshots reviewed at 1440 and 390 px; no horizontal overflow in ar.
- Arabic font loads; no letter-spacing on Arabic; plural messages cover all six categories.
```

## B.7 Evals and demo

- **Fixture app** (`registry/official/arabic-rtl/evals/fixture-app/`): a small English-only Next.js + Tailwind app with physical classes, hardcoded strings, directional icons, a form, prices, dates, a counted message ("3 items"), a carousel and a sidebar.
- **Tasks:** full conversion; add Arabic to one new page in an already-converted app; fix a regression introduced on purpose.
- **Measure:** rtl-scan errors before/after, translate-check result, tokens with vs without the skill, and a visual rubric scored from screenshots (mirroring, alignment, typography, overflow, number formats). Native-speaker spot check of translations by me before publishing numbers.
- **Demo:** produce an Arabic version of the `design-clean-saas` demo site (V2) using the skill; deploy it; the skill page shows English vs Arabic screenshots side by side, plus a live demo link.

## B.8 Milestones

**B1 — Scripts and references.** All five scripts with tests on the fixture app; all references written and API-verified.
*Done when:* codemod is idempotent with a full test matrix of variants; rtl-scan finds every seeded problem in the fixture; translate-check catches missing plural categories and placeholder mismatches.

**B2 — Skill, assets, companion.** SKILL.md, assets (starter messages with at least 150 common UI strings, glossary, fonts, components), `rtl-check` companion skill, `i18n.config.json` flow; passes `lint:skills` and gets grade A from `aisle audit`.
*Done when:* running `/arabic-rtl` on the fixture app in a fresh session reaches all "Done when" checks without manual code fixes.

**B3 — Evals, demo, page.** Eval runs, Arabic demo site, preview screenshots, skill page with numbers and demo link. Publish (ask me first).
*Done when:* the skill page is live with real before/after screenshots and measured numbers.

---

## Rules for Claude Code on this brief

- Never execute, import or `require` files from a skill being audited, including in tests.
- Malicious fixtures stay inert and clearly labeled as test data.
- Verify library and tool APIs (next-intl, Tailwind logical utilities, Intl calendars, Claude Code skill syntax, SARIF) against official docs; write `TODO(verify)` where you can't, and tell me.
- Ask before: adding dependencies, any paid API call, publishing the GitHub Action, publishing to npm, or deploying.
- Show intermediate results on B1 (scan and codemod output on the fixture) before writing the skill text.
