import type { Metadata } from "next";
import { CodeBlock } from "../../components/CodeBlock";
import { Section } from "../../components/Section";
import { REPO_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Docs",
  description: "Install the Agent Aisle CLI, learn every command, and write a good skill.",
};

const commands: Array<[string, string, boolean]> = [
  [
    "aisle add <name>[@version] ...",
    "Install one or more skills. Without a version you get the latest.",
    true,
  ],
  [
    "aisle add <owner>/<repo>[/path][@ref]",
    "Install straight from any GitHub repo, even if it isn't listed. Shown as unverified.",
    true,
  ],
  ["aisle remove <name>", "Delete the skill folder and its lockfile entry.", true],
  [
    "aisle list",
    "Show installed skills and their versions, and flag ones that have an update.",
    true,
  ],
  ["aisle info <name>", "Description, author, versions, clients and any scripts warning.", true],
  [
    "aisle search <query>",
    "Search the registry by name, aisle, author or description, best match first.",
    true,
  ],
  [
    "aisle update [name]",
    "Update one or all installed skills to the latest version. Skills installed from GitHub are skipped.",
    true,
  ],
  [
    "aisle init [--profile <id>] [--no-rules | --rules-only]",
    "Install a starter bundle and add the Agent Aisle house rules to CLAUDE.md (AGENTS.md for Codex and Cursor). With --profile it never asks which bundle.",
    true,
  ],
];

const flags: Array<[string, string]> = [
  [
    "--global, -g",
    "Use the user-level skills folder (for example ~/.claude/skills) instead of the project.",
  ],
  [
    "--agent <name>",
    "claude-code, codex or cursor. By default the CLI detects it from your project and falls back to claude-code.",
  ],
  [
    "--yes, -y",
    "Skip confirmation prompts. Required when there is no terminal, for example in CI.",
  ],
  ["--dry-run", "Show what would be installed or removed without changing anything."],
];

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border border-line-strong">
      <table className="w-full text-left text-sm">
        <thead className="bg-bg-sunken">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="hud-label px-4 py-2.5 text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  return (
    <>
      <div className="px-4 py-12 sm:px-8">
        <p className="hud-label text-accent-ink">Docs</p>
        <h1 className="mt-3 text-3xl">Using Agent Aisle</h1>
        <p className="mt-3 text-muted">Install the CLI, add skills, and write your own.</p>
      </div>

      <Section id="install" number="01" title="Install the CLI" intro="Needs Node.js 20 or newer.">
        <div className="space-y-5">
          <p className="text-sm">Run it without installing anything:</p>
          <CodeBlock label="Run with npx">{"npx @agentsaisle/cli add explore"}</CodeBlock>
          <p className="text-sm">
            Or install it once and use the short name <code className="font-mono">aisle</code>:
          </p>
          <CodeBlock label="Install globally">
            {"npm i -g @agentsaisle/cli\naisle add explore"}
          </CodeBlock>
          <p className="text-sm text-muted">
            We don&apos;t use <code className="font-mono">npm install</code> for skills. It puts
            packages in <code className="font-mono">node_modules</code>, which agents don&apos;t
            read. The CLI puts the skill folder where your agent looks for it, for example{" "}
            <code className="font-mono">.claude/skills/explore/</code>.
          </p>
        </div>
      </Section>

      <Section id="commands" number="02" title="Commands">
        <div className="space-y-8">
          <Table head={["Command", "What it does"]}>
            {commands.map(([cmd, what, ready]) => (
              <tr key={cmd} className="border-t border-line align-top">
                <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">{cmd}</td>
                <td className="px-4 py-3 text-muted">
                  {what}
                  {!ready && <span className="hud-label ml-2 text-accent-ink">coming soon</span>}
                </td>
              </tr>
            ))}
          </Table>
          <div>
            <h3 className="mb-3 text-lg">Flags for add, remove, list, init and update</h3>
            <Table head={["Flag", "What it does"]}>
              {flags.map(([flag, what]) => (
                <tr key={flag} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">{flag}</td>
                  <td className="px-4 py-3 text-muted">{what}</td>
                </tr>
              ))}
            </Table>
            <p className="mt-3 text-sm text-muted">
              Installs are recorded in <code className="font-mono">aisle-lock.json</code> in your
              project root (or your home folder with <code className="font-mono">--global</code>).
              Development files in a skill folder (<code className="font-mono">evals/</code>,{" "}
              <code className="font-mono">preview/</code> and the top-level{" "}
              <code className="font-mono">README.md</code>) are not installed.
            </p>
            <h3 className="mt-8 mb-3 text-lg">House rules</h3>
            <p className="text-sm text-muted">
              <code className="font-mono">aisle init</code> writes a short block of working rules
              (search before reading, change only what the task needs, run the checks before saying
              done) between <code className="font-mono">&lt;!-- agent-aisle:start --&gt;</code> and{" "}
              <code className="font-mono">&lt;!-- agent-aisle:end --&gt;</code> markers. Running it
              again replaces only that block and never touches the rest of the file. Use{" "}
              <code className="font-mono">--rules-only</code> to skip the skills or{" "}
              <code className="font-mono">--no-rules</code> to skip the rules.
            </p>
          </div>
        </div>
      </Section>

      <Section id="skills" number="03" title="What a skill is">
        <div className="space-y-4 text-sm">
          <p>
            A skill is a folder with a <code className="font-mono">SKILL.md</code> file. The file
            starts with a name and a description, then explains to your agent how to do one job.
            Agents read the description to decide when a skill applies, and load the rest when it
            does.
          </p>
          <CodeBlock label="A minimal SKILL.md">{`---
name: commit
description: Write a clear git commit for the current changes. Use when asked to commit.
---

# Commit

1. Run git status and git diff.
2. Group the changes into logical commits.
3. Write a short imperative subject and explain why in the body.`}</CodeBlock>
        </div>
      </Section>

      <Section id="write" number="04" title="Write a good skill">
        <ul className="list-[square] space-y-3 pl-5 text-sm">
          <li>
            <strong>Name it in lowercase kebab-case</strong>, and make the folder name and the{" "}
            <code className="font-mono">name</code> in the frontmatter identical.
          </li>
          <li>
            <strong>Say what it does and when to use it</strong> in the description, in one or two
            sentences. That text is how an agent chooses the skill.
          </li>
          <li>
            <strong>Do one job.</strong> If you find yourself writing &quot;and also&quot;, split it
            into two skills.
          </li>
          <li>
            <strong>Keep SKILL.md short.</strong> Put long reference material in separate files in
            the same folder and link to them.
          </li>
          <li>
            <strong>Avoid scripts when you can.</strong> If a skill needs them, put them in a{" "}
            <code className="font-mono">scripts/</code> folder. Users are warned and asked to
            confirm before installing, and reviewers read every script.
          </li>
          <li>
            <strong>Try it yourself first</strong> in a clean project before you submit it.
          </li>
        </ul>
      </Section>

      <Section id="safety" number="05" title="How installs stay safe">
        <ul className="list-[square] space-y-3 pl-5 text-sm">
          <li>
            Every version is pinned to a full commit, so a later push to the author&apos;s
            repository can&apos;t change what you install.
          </li>
          <li>The CLI downloads and copies files. It never runs anything from a skill.</li>
          <li>
            Skills with scripts list the files. Community and unverified skills ask before
            installing; verified official skills, whose scripts a maintainer has read in full, list
            them without asking.
          </li>
          <li>
            <strong>Verified</strong> means a maintainer read the skill and any scripts in full.
            Community skills are <strong>unverified</strong> until then, and labeled that way
            everywhere.
          </li>
          <li>
            See something wrong? Use &quot;Report this skill&quot; on its page, or open an issue on{" "}
            <a href={REPO_URL} className="text-accent-ink underline underline-offset-4">
              GitHub
            </a>
            .
          </li>
        </ul>
      </Section>
    </>
  );
}
