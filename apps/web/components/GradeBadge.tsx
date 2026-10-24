import type { AuditGrade } from "@agentsaisle/registry-schema";
import { GRADE_WORDS } from "../lib/audit-labels";

// Each grade differs in fill and border as well as letter, so none relies on color alone.
const styles: Record<AuditGrade, string> = {
  A: "border-line-strong text-ink",
  B: "border-line-strong text-ink",
  C: "border-dashed border-line-strong bg-bg-sunken text-ink",
  D: "border-dashed border-ink bg-bg-sunken text-ink",
  F: "border-invert-bg bg-invert-bg text-invert-fg",
};

/** The audit grade as a small badge: "Audit A". */
export function GradeBadge({ grade, size = "sm" }: { grade: AuditGrade; size?: "sm" | "lg" }) {
  const label = `Audit grade ${grade}: ${GRADE_WORDS[grade]}`;
  if (size === "lg") {
    return (
      <span
        role="img"
        aria-label={label}
        className={`inline-flex size-16 items-center justify-center border text-3xl font-bold ${styles[grade]}`}
      >
        {grade}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`hud-label inline-flex h-6 items-center gap-1.5 border px-2 ${styles[grade]}`}
    >
      Audit
      <b className="font-bold">{grade}</b>
    </span>
  );
}
