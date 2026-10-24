import { GRADES, RULE_GROUPS } from "@agentsaisle/audit/catalog";
import type { AuditGrade } from "@agentsaisle/registry-schema";
import type { Metadata } from "next";
import { CodeBlock } from "../../components/CodeBlock";
import { GradeBadge } from "../../components/GradeBadge";
import { Section } from "../../components/Section";
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

  return (
    <>
      <div className="px-4 py-12 sm:px-8">
        <p className="hud-label text-accent-ink">Audit</p>
        <h1 className="mt-3 text-3xl">Check a skill before you trust it</h1>
        <p className="mt-3 max-w-prose text-muted">
          <code className="font-mono">aisle audit</code> is a free, open-source scanner. It reads a
          skill folder as text and reports risky patterns. It never runs, imports or installs
          anything from the skill.
        </p>
        <p className="mt-3 max-w-prose text-sm">{DISCLAIMER}</p>
      </div>

      <Section id="where" number="01" title="Where it runs" intro="The same rules everywhere.">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            <b>On your machine:</b> <code className="font-mono">aisle audit &lt;target&gt;</code>{" "}
            for any local folder, registry skill or GitHub repo.
          </li>
          <li>
            <b>Before every install:</b> <code className="font-mono">aisle add</code> audits the
            files it is about to install. A critical finding blocks the install; it needs{" "}
            <code className="font-mono">--force</code> and typing the skill&apos;s name to go on.
          </li>
          <li>
            <b>On every submission:</b> each community skill is audited at its pinned commit when it
            is submitted, and the result is shown on its page.
          </li>
        </ul>
        {audited.length > 0 && (
          <div className="mt-6">
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

      <Section id="grades" number="02" title="Grades" intro="Findings are counted by severity.">
        <div className="overflow-x-auto border border-line-strong">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-sunken">
              <tr>
                <th scope="col" className="hud-label px-4 py-2.5 text-muted">
                  Grade
                </th>
                <th scope="col" className="hud-label px-4 py-2.5 text-muted">
                  Meaning
                </th>
              </tr>
            </thead>
            <tbody>
              {GRADES.map((g) => (
                <tr key={g.grade} className="border-t border-line">
                  <td className="px-4 py-3">
                    <GradeBadge grade={g.grade as AuditGrade} />
                  </td>
                  <td className="px-4 py-3 text-muted">{g.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted">
          A grade is a summary, not a verdict. Read the findings: a skill about security can
          legitimately quote the phrases the scanner looks for.
        </p>
      </Section>

      <Section
        id="rules"
        number="03"
        title="What it checks"
        intro="Rule IDs start with AA. Every rule has a malicious and a benign test fixture."
      >
        <div className="space-y-8">
          {RULE_GROUPS.map((group) => (
            <div key={group.prefix}>
              <h3 className="mb-3 text-lg">{group.name}</h3>
              <div className="overflow-x-auto border border-line-strong">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {group.rules.map((r) => (
                      <tr key={r.id} className="border-t border-line first:border-t-0 align-top">
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
            </div>
          ))}
          <p className="text-sm">
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
        </div>
      </Section>

      <Section
        id="suppress"
        number="04"
        title="Suppressions"
        intro="Authors can explain a pattern that is intentional."
      >
        <div className="space-y-4">
          <p className="text-sm">
            An author puts a <code className="font-mono">.aisleaudit.yaml</code> file in the skill.
            Each entry needs a reason of at least 15 characters. Suppressed findings do not count
            towards the grade, but they are always listed, with the reason. Critical findings cannot
            be suppressed by the author.
          </p>
          <CodeBlock label="Example .aisleaudit.yaml">
            {`ignore:
  - rule: AA-N01
    path: references/legacy-api.md
    reason: Documents an old HTTP-only endpoint; no requests are made.`}
          </CodeBlock>
        </div>
      </Section>

      <Section id="run" number="05" title="Run it yourself">
        <div className="space-y-5">
          <CodeBlock label="Audit examples">
            {`aisle audit ./my-skill
aisle audit some-skill@1.2.0
aisle audit owner/repo/path/to/skill@main
aisle audit . --format sarif --output audit.sarif
aisle audit . --format markdown --fail-on medium`}
          </CodeBlock>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <code className="font-mono">--format</code>: pretty (default), json, sarif (for
              GitHub&apos;s Security tab) or markdown.
            </li>
            <li>
              <code className="font-mono">--fail-on</code>: critical, high (default), medium, low or
              none. Sets the exit code: 0 clean, 1 findings at or above that level, 2 the audit
              could not run.
            </li>
            <li>
              <code className="font-mono">--output &lt;file&gt;</code> writes the report to a file;{" "}
              <code className="font-mono">--quiet</code> prints one summary line.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="limits" number="06" title="What an audit cannot do">
        <p className="max-w-prose text-sm">
          An audit reduces risk; it cannot prove a skill safe. It finds patterns it knows about. A
          determined author can write something it misses, and a clean report says nothing about
          what the skill&apos;s instructions will make an agent do in your project. Read the files
          of any skill that runs scripts, and install community skills pinned to a version.
        </p>
      </Section>
    </>
  );
}
