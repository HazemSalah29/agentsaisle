import type { AuditFinding, AuditReport } from "@agentsaisle/registry-schema";
import { getAuditReport } from "../lib/audit";
import { AUDIT_RULES_URL, SEVERITIES, severityLabel } from "../lib/audit-labels";
import { badgeMarkdown } from "../lib/badge";
import { SITE_URL } from "../lib/site";
import { CodeBlock } from "./CodeBlock";
import { GradeBadge } from "./GradeBadge";

const code = "font-mono text-sm";

function FindingItem({ f }: { f: AuditFinding }) {
  const where = f.line ? `${f.file}:${f.line}` : f.file;
  return (
    <details
      open={(f.severity === "critical" || f.severity === "high") && !f.suppressed}
      className="border-t border-line first:border-t-0"
    >
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
        <span className="hud-label text-muted">{severityLabel(f.severity)}</span>
        <span className="hud-label text-accent-ink">{f.rule}</span>
        <span className="text-sm">{f.title}</span>
        {f.suppressed && <span className="hud-label text-muted">suppressed</span>}
      </summary>
      <div className="space-y-2 px-4 pb-4 text-sm">
        <p className={`${code} text-muted [overflow-wrap:anywhere]`}>{where}</p>
        {f.excerpt && (
          <pre className={`${code} overflow-x-auto border border-line bg-bg-sunken p-3`}>
            <code>{f.excerpt}</code>
          </pre>
        )}
        <p>
          <span className="hud-label text-muted">Why </span>
          {f.why}
        </p>
        <p>
          <span className="hud-label text-muted">Fix </span>
          {f.fix}
        </p>
        {f.suppressed && (
          <p>
            <span className="hud-label text-muted">Author&apos;s reason </span>
            {f.suppressed.reason}
          </p>
        )}
        {f.source === "deep" && <p className="hud-label text-muted">AI-assisted, may be wrong</p>}
      </div>
    </details>
  );
}

function Inventory({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="hud-label text-muted">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm">None</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((i) => (
            <li key={i} className={`${code} border border-line px-2 py-1 [overflow-wrap:anywhere]`}>
              {i}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The audit report of one skill version, or a plain "not audited yet" note. */
export function AuditView({ report }: { report: AuditReport | undefined }) {
  if (!report) {
    return (
      <p className="text-sm">
        Not audited yet. Run <code className="font-mono">aisle audit</code> on it yourself before
        you install.
      </p>
    );
  }
  const shown = report.findings.filter((f) => f.severity !== "info");
  const inv = report.inventory;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-5">
        <GradeBadge grade={report.grade} size="lg" />
        <dl className="grid grid-cols-4 gap-px border border-line-strong bg-line-strong text-center">
          {SEVERITIES.map((s) => (
            <div key={s} className="bg-bg-raised px-4 py-2">
              <dt className="hud-label text-muted">{severityLabel(s)}</dt>
              <dd className="text-lg font-bold">{report.counts[s]}</dd>
            </div>
          ))}
        </dl>
        <p className="hud-label text-muted">
          {report.files} files · audited {report.auditedAt.slice(0, 10)} · rules{" "}
          {report.auditVersion}
        </p>
      </div>

      {shown.length > 0 ? (
        <div className="border border-line-strong bg-bg-raised">
          {shown.map((f, i) => (
            <FindingItem key={`${f.rule}-${f.file}-${f.line ?? 0}-${i}`} f={f} />
          ))}
        </div>
      ) : (
        <p className="text-sm">No findings.</p>
      )}

      {inv && (
        <div className="space-y-4">
          <h3 className="text-lg">What this skill can use</h3>
          <Inventory title="Tools" items={inv.tools} />
          <Inventory title="Scripts" items={inv.scripts} />
          <Inventory title="Domains mentioned" items={inv.domains} />
        </div>
      )}

      <p className="text-sm text-muted">
        {report.disclaimer}{" "}
        <a href="/audit" className="text-accent-ink underline underline-offset-4">
          How audits work
        </a>
        {" · "}
        <a
          href={AUDIT_RULES_URL}
          rel="noopener noreferrer"
          className="text-accent-ink underline underline-offset-4"
        >
          Read the rules
        </a>
      </p>
    </div>
  );
}

/** How a skill's author puts the audit grade in a README. */
export function BadgeSnippet({ siteUrl, name }: { siteUrl: string; name: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg">Show this grade in a README</h3>
      <p className="text-sm text-muted">
        The badge updates when the registry is rebuilt. Paste this Markdown into the README:
      </p>
      <CodeBlock label={`Badge Markdown for ${name}`}>{badgeMarkdown(siteUrl, name)}</CodeBlock>
    </div>
  );
}

export function AuditBlock({ name, version }: { name: string; version: string }) {
  return (
    <section aria-labelledby="audit" className="space-y-4">
      <h2 id="audit" className="text-xl">
        Audit
      </h2>
      <AuditView report={getAuditReport(name, version)} />
      <BadgeSnippet siteUrl={SITE_URL} name={name} />
    </section>
  );
}
