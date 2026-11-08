import { GRADES, RULE_GROUPS } from "@agentsaisle/audit/catalog";
import type { AuditGrade } from "@agentsaisle/registry-schema";
import type { Metadata } from "next";
import { CodeBlock } from "../../components/CodeBlock";
import { GradeBadge } from "../../components/GradeBadge";
import { Section } from "../../components/Section";
import { CardGrid, CardItem } from "../../components/simple/Cards";
import { MoreDetails } from "../../components/simple/MoreDetails";
import { PageIntro, PrimaryLink, SecondaryLink } from "../../components/simple/PageIntro";
import { AUDIT_RULES_URL, severityLabel } from "../../lib/audit-labels";
import { getRegistry } from "../../lib/registry";

export const metadata: Metadata = {
  title: "Audit",
  description:
    "How aisle audit scans Agent Skills for risky patterns without running anything in them, what the grades mean, and how to run it yourself.",
};

const DISCLAIMER =
  "Automated checks found no known risky patterns. This is not a guarantee of safety.";

export default function AuditPage() {
  const audited = getRegistry().skills.filter((s) => s.audit);
  const tally = (["A", "B", "C", "D", "F"] as AuditGrade[]).map(
    (g) => [g, audited.filter((s) => s.audit?.grade === g).length] as const,
  );

  const ruleCount = RULE_GROUPS.reduce((n, g) => n + g.rules.length, 0);
  const where = [
    ["On your machine", "Check any local folder, registry skill or GitHub repo with one command."],
    [
      "Before every install",
      "The installer checks the files first. A critical finding stops it until you confirm.",
    ],
    [
      "On every submission",
      "Each community skill is checked at its fixed version, and the grade shows on its page.",
    ],
  ] as const;

  return (
    <>
      <PageIntro
        size="lg"
        eyebrow="Audit"
        lines={["Check a skill"]}
        accent="before you trust it."
        intro={
          <>
            <p>
              <code className="font-mono">aisle audit</code> is a free, open-source scanner. It
              reads a skill as text and reports risky patterns. It never runs anything from the
              skill.
            </p>
            <p className="mt-3 text-sm">{DISCLAIMER}</p>
          </>
        }
        actions={
          <>
            <PrimaryLink href="#run">Run it yourself</PrimaryLink>
            <SecondaryLink href="#grades">What the grades mean</SecondaryLink>
          </>
        }
      />

      <Section id="where" number="01" title="Where it runs" intro="The same rules everywhere.">
        <CardGrid className="md:grid-cols-3" label="Where it runs">
          {where.map(([title, body]) => (
            <CardItem key={title}>
              <div className="p-5">
                <h3 className="text-base">{title}</h3>
                <p className="mt-2 text-sm text-muted">{body}</p>
              </div>
            </CardItem>
          ))}
        </CardGrid>
        {audited.length > 0 && (
          <div className="mt-8">
            <p className="hud-label text-muted">
              In this registry, {audited.length} skills audited
            </p>
            <ul className="mt-2 flex flex-wrap gap-3">
              {tally.map(([g, n]) => (
                <li key={g} className="flex items-center gap-2 text-sm">
                  <GradeBadge grade={g} />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section
        id="grades"
        number="02"
        title="Grades"
        intro="Findings are counted by how serious they are."
      >
        <CardGrid className="sm:grid-cols-2 xl:grid-cols-5" label="Grades">
          {GRADES.map((g) => (
            <CardItem key={g.grade} plain>
              <div className="p-5">
                <GradeBadge grade={g.grade as AuditGrade} />
                <p className="mt-3 text-sm text-muted">{g.meaning}</p>
              </div>
            </CardItem>
          ))}
        </CardGrid>
        <p className="mt-6 max-w-prose text-sm text-muted">
          A grade is a summary, not a verdict. Read the findings: a skill about security can
          legitimately quote the phrases the scanner looks for.
        </p>
      </Section>

      <Section
        id="rules"
        number="03"
        title="What it checks"
        intro={`${ruleCount} rules in ${RULE_GROUPS.length} families. Open one to see its rules.`}
      >
        <div className="max-w-4xl space-y-3">
          {RULE_GROUPS.map((group) => (
            <MoreDetails
              key={group.prefix}
              tone="boxed"
              title={group.name}
              hint={`${group.rules.length} ${group.rules.length === 1 ? "rule" : "rules"}`}
            >
              <div className="overflow-x-auto border border-line-strong">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {group.rules.map((r) => (
                      <tr key={r.id} className="border-t border-line align-top first:border-t-0">
                        <td className="hud-label px-4 py-3 whitespace-nowrap text-accent-ink">
                          {r.id}
                        </td>
                        <td className="hud-label px-4 py-3 whitespace-nowrap text-muted">
                          {severityLabel(r.severity)}
                        </td>
                        <td className="px-4 py-3">{r.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </MoreDetails>
          ))}
        </div>
        <p className="mt-6 text-sm">
          The rules are open source (MIT):{" "}
          <a
            href={AUDIT_RULES_URL}
            rel="noopener noreferrer"
            className="text-accent-ink underline underline-offset-4"
          >
            read them on GitHub
          </a>
          .
        </p>
      </Section>

      <Section
        id="suppress"
        number="04"
        title="Suppressions"
        intro="Authors can explain a pattern that is intentional."
      >
        <p className="max-w-prose text-sm">
          An author adds a <code className="font-mono">.aisleaudit.yaml</code> file with a reason of
          at least 15 characters. Suppressed findings do not count towards the grade, but they are
          always listed with the reason. Critical findings cannot be suppressed.
        </p>
        <div className="mt-5 max-w-4xl">
          <MoreDetails tone="boxed" title="Example .aisleaudit.yaml">
            <CodeBlock label="Example .aisleaudit.yaml">
              {`ignore:
  - rule: AA-N01
    path: references/legacy-api.md
    reason: Documents an old HTTP-only endpoint; no requests are made.`}
            </CodeBlock>
          </MoreDetails>
        </div>
      </Section>

      <Section
        id="run"
        number="05"
        title="Run it yourself"
        intro="Copy a line, paste it into Terminal."
      >
        <div className="max-w-4xl space-y-4">
          <CodeBlock label="Audit examples">
            {`aisle audit ./my-skill
aisle audit some-skill@1.2.0
aisle audit owner/repo/path/to/skill@main
aisle audit . --format sarif --output audit.sarif
aisle audit . --format markdown --fail-on medium`}
          </CodeBlock>
          <MoreDetails tone="boxed" title="All the options">
            <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>
                <code className="font-mono">--format</code>: pretty (default), json, sarif (for
                GitHub&apos;s Security tab) or markdown.
              </li>
              <li>
                <code className="font-mono">--fail-on</code>: critical, high (default), medium, low
                or none. Sets the exit code: 0 clean, 1 findings at or above that level, 2 the audit
                could not run.
              </li>
              <li>
                <code className="font-mono">--output &lt;file&gt;</code> writes the report to a
                file; <code className="font-mono">--quiet</code> prints one summary line.
              </li>
            </ul>
          </MoreDetails>
        </div>
      </Section>

      <Section id="badge" number="06" title="Badge and GitHub Action" intro="For skill authors.">
        <div className="max-w-4xl space-y-3">
          <MoreDetails
            tone="boxed"
            title="Show your grade in a README"
            hint="A badge that updates itself"
          >
            <p className="mb-4 text-sm">
              Every skill page shows a README badge for its grade. It is a shields.io endpoint badge
              that reads <code className="font-mono">/badges/&lt;name&gt;.json</code>:
            </p>
            <CodeBlock label="Badge Markdown">
              {`[![aisle audit](https://img.shields.io/endpoint?url=https%3A%2F%2F<site>%2Fbadges%2F<name>.json)](https://<site>/skills/<name>)`}
            </CodeBlock>
          </MoreDetails>
          <MoreDetails
            tone="boxed"
            title="Check your own repository on every push"
            hint="The Agents Aisle audit GitHub Action"
          >
            <p className="mb-4 text-sm">
              It runs <code className="font-mono">aisle audit . --format sarif</code> and uploads
              the result to GitHub&apos;s Security tab:
            </p>
            <CodeBlock label="Workflow example">
              {`name: Aisle audit
on: [push, pull_request]
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
          fail-on: high`}
            </CodeBlock>
          </MoreDetails>
        </div>
      </Section>

      <Section id="limits" number="07" title="What an audit cannot do">
        <div className="max-w-prose border border-dashed border-line-strong bg-bg-raised p-5">
          <p className="text-sm">
            An audit reduces risk; it cannot prove a skill safe. It finds patterns it knows about. A
            determined author can write something it misses, and a clean report says nothing about
            what the skill&apos;s instructions will make an agent do in your project. Read the files
            of any skill that runs scripts, and install community skills pinned to a version.
          </p>
        </div>
      </Section>
    </>
  );
}
