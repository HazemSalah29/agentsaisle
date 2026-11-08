import type { Metadata } from "next";
import { CodeBlock } from "../../components/CodeBlock";
import { Section } from "../../components/Section";
import { CardGrid, CardItem } from "../../components/simple/Cards";
import { ManageSkill } from "../../components/simple/ManageSkill";
import { MoreDetails } from "../../components/simple/MoreDetails";
import { PageIntro, PrimaryLink, SecondaryLink } from "../../components/simple/PageIntro";
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
    "aisle audit <target> [--format pretty|json|sarif|markdown] [--fail-on <level>]",
    "Scan a skill for risky patterns without running anything in it. Target is a local folder, a registry name or a GitHub repo. See the Audit page.",
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

const tips: Array<[string, React.ReactNode]> = [
  [
    "Name it in lowercase with dashes",
    <>
      Make the folder name and the <code className="font-mono">name</code> in the file identical.
    </>,
  ],
  [
    "Say what it does and when to use it",
    "One or two sentences in the description. That text is how an agent chooses the skill.",
  ],
  ["Do one job", 'If you find yourself writing "and also", split it into two skills.'],
  [
    "Keep SKILL.md short",
    "Put long reference material in separate files in the same folder and link to them.",
  ],
  [
    "Avoid scripts when you can",
    <>
      If a skill needs them, put them in a <code className="font-mono">scripts/</code> folder. Users
      are warned first and reviewers read every script.
    </>,
  ],
  ["Try it yourself first", "Run it in a clean project before you submit it."],
];

const safe: Array<[string, React.ReactNode]> = [
  [
    "Fixed versions",
    "Every version is pinned to one exact commit, so a later change by the author can't change what you install.",
  ],
  [
    "Nothing is run",
    "The installer downloads and copies files. It never runs anything from a skill.",
  ],
  [
    "Scripts are listed",
    "A skill with scripts lists them. Community skills ask before they install.",
  ],
  [
    "Verified means read",
    "A maintainer read the skill and its scripts in full. Everything else is labeled unverified.",
  ],
];

const shelves: Array<[string, React.ReactNode]> = [
  [
    "Aisles",
    <>
      Skills grouped by what they are for.{" "}
      <a href="/aisles" className="text-accent-ink underline underline-offset-4">
        Browse the aisles
      </a>
      .
    </>,
  ],
  [
    "Kits",
    <>
      Skills that work together. Install one with{" "}
      <code className="font-mono">aisle init --profile &lt;kit-id&gt;</code>.
    </>,
  ],
  [
    "Elsewhere",
    "Skills by other authors. We link to them and show their license. We do not host or install them.",
  ],
];

const card = (title: string, body: React.ReactNode) => (
  <CardItem key={title}>
    <div className="p-5">
      <h3 className="text-base">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  </CardItem>
);

export default function DocsPage() {
  return (
    <>
      <PageIntro
        size="lg"
        eyebrow="Docs"
        lines={["Using Agent Aisle"]}
        accent="step by step."
        intro="Add skills, keep them up to date, and write your own."
        actions={
          <>
            <PrimaryLink href="#install">Get started</PrimaryLink>
            <SecondaryLink href="#write">Write a skill</SecondaryLink>
          </>
        }
      />

      <Section
        id="install"
        number="01"
        title="Get started"
        intro="You need Node.js 20 or newer. It is free from nodejs.org."
      >
        <div className="max-w-4xl space-y-4">
          <CodeBlock label="Add your first skill">{"npx @agentsaisle/cli add explore"}</CodeBlock>
          <MoreDetails
            tone="boxed"
            title="Install it once, use the short name"
            hint="aisle instead of npx @agentsaisle/cli"
          >
            <CodeBlock label="Install globally">
              {"npm i -g @agentsaisle/cli\naisle add explore"}
            </CodeBlock>
            <p className="mt-4 text-sm text-muted">
              We don&apos;t use <code className="font-mono">npm install</code> for skills. It puts
              packages in <code className="font-mono">node_modules</code>, which agents don&apos;t
              read. The CLI puts the skill folder where your agent looks for it, for example{" "}
              <code className="font-mono">.claude/skills/explore/</code>.
            </p>
          </MoreDetails>
          <MoreDetails tone="boxed" title="If the install fails" hint="The three common problems">
            <div className="space-y-4">
              <p className="text-sm">
                <strong>
                  <code className="font-mono">EACCES: permission denied</code> on a global install.
                </strong>{" "}
                npm can&apos;t write to a folder owned by root. Use{" "}
                <code className="font-mono">npx</code> above, or move npm&apos;s global folder into
                your home directory (no <code className="font-mono">sudo</code> needed):
              </p>
              <CodeBlock label="Global installs without sudo">
                {
                  "mkdir -p ~/.npm-global\nnpm config set prefix ~/.npm-global\necho 'export PATH=\"$HOME/.npm-global/bin:$PATH\"' >> ~/.zshrc\nsource ~/.zshrc\nnpm i -g @agentsaisle/cli"
                }
              </CodeBlock>
              <p className="text-sm text-muted">
                Use <code className="font-mono">~/.bashrc</code> instead of{" "}
                <code className="font-mono">~/.zshrc</code> if you use bash. Node installed through
                nvm or Homebrew usually doesn&apos;t have this problem.
              </p>
              <p className="text-sm">
                <strong>
                  <code className="font-mono">sh: aisle: command not found</code> from npx.
                </strong>{" "}
                This happens when you run <code className="font-mono">npx</code> inside a clone of
                the Agent Aisle repository, because npx finds the local package and can&apos;t run
                it. Run the command from your own project folder instead, or pin the published
                version:
              </p>
              <CodeBlock label="Use the published package">
                {"npx @agentsaisle/cli@latest add explore"}
              </CodeBlock>
              <p className="text-sm">
                <strong>Version looks old.</strong> Check{" "}
                <code className="font-mono">aisle --version</code>. If it prints an older number,
                run <code className="font-mono">npm cache clean --force</code> and install again.
              </p>
            </div>
          </MoreDetails>
        </div>
      </Section>

      <Section
        id="commands"
        number="02"
        title="Add, update or remove"
        intro="The same three lines work for any skill. Here they are for explore."
      >
        <div className="max-w-4xl space-y-4">
          <ManageSkill name="explore" />
          <MoreDetails
            tone="boxed"
            title="Every command and option"
            hint="For when you want the full list"
          >
            <div className="space-y-8">
              <Table head={["Command", "What it does"]}>
                {commands.map(([cmd, what, ready]) => (
                  <tr key={cmd} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">{cmd}</td>
                    <td className="px-4 py-3 text-muted">
                      {what}
                      {!ready && (
                        <span className="hud-label ml-2 text-accent-ink">coming soon</span>
                      )}
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
                  Installs are recorded in <code className="font-mono">aisle-lock.json</code> in
                  your project root (or your home folder with{" "}
                  <code className="font-mono">--global</code>). Development files in a skill folder
                  (<code className="font-mono">evals/</code>,{" "}
                  <code className="font-mono">preview/</code> and the top-level{" "}
                  <code className="font-mono">README.md</code>) are not installed.
                </p>
              </div>
              <div>
                <h3 className="mb-3 text-lg">House rules</h3>
                <p className="text-sm text-muted">
                  <code className="font-mono">aisle init</code> writes a short block of working
                  rules (search before reading, change only what the task needs, run the checks
                  before saying done) between{" "}
                  <code className="font-mono">&lt;!-- agent-aisle:start --&gt;</code> and{" "}
                  <code className="font-mono">&lt;!-- agent-aisle:end --&gt;</code> markers. Running
                  it again replaces only that block and never touches the rest of the file. Use{" "}
                  <code className="font-mono">--rules-only</code> to skip the skills or{" "}
                  <code className="font-mono">--no-rules</code> to skip the rules.
                </p>
              </div>
            </div>
          </MoreDetails>
        </div>
      </Section>

      <Section
        id="skills"
        number="03"
        title="What a skill is"
        intro="A folder with one file that tells your agent how to do one job."
      >
        <div className="max-w-4xl space-y-4 text-sm">
          <p className="max-w-prose">
            The file is called <code className="font-mono">SKILL.md</code>. It starts with a name
            and a description. Agents read the description to decide when a skill applies, and load
            the rest when it does.
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

      <Section
        id="write"
        number="04"
        title="Write a good skill"
        intro="Six habits that make a skill easy to trust."
      >
        <CardGrid className="sm:grid-cols-2 xl:grid-cols-3" label="Tips">
          {tips.map(([title, body]) => card(title, body))}
        </CardGrid>
      </Section>

      <Section id="safety" number="05" title="How installs stay safe">
        <CardGrid className="sm:grid-cols-2 xl:grid-cols-4" label="Safety">
          {safe.map(([title, body]) => card(title, body))}
        </CardGrid>
        <p className="mt-6 text-sm">
          See something wrong? Use &quot;Report this skill&quot; on its page, or open an issue on{" "}
          <a href={REPO_URL} className="text-accent-ink underline underline-offset-4">
            GitHub
          </a>
          .
        </p>
      </Section>

      <Section id="aisles" number="06" title="Aisles, kits and Elsewhere">
        <CardGrid className="md:grid-cols-3" label="Ways to browse">
          {shelves.map(([title, body]) => card(title, body))}
        </CardGrid>
      </Section>
    </>
  );
}
