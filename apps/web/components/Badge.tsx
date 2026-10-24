import type { ReactNode } from "react";

export type BadgeKind = "official" | "verified" | "unverified" | "scripts" | "untested";

const copy: Record<BadgeKind, string> = {
  official: "Official",
  verified: "Verified",
  unverified: "Unverified",
  scripts: "Runs scripts",
  untested: "Untested",
};

const icons: Record<BadgeKind, ReactNode> = {
  official: (
    <path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.5 6.8 19.2l1-5.9L3.5 9.2l5.9-.8L12 3Z" />
  ),
  verified: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  unverified: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5M12 16v.5" />
    </>
  ),
  scripts: <path d="M12 3l10 18H2L12 3Zm0 7v5m0 3v.5" />,
  // A flask: this skill has not been through the measured tests yet.
  untested: <path d="M9 3h6M10 3v6L5 19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1l-5-10V3" />,
};

// Each state differs in shape or fill as well as color, so none relies on color alone.
const styles: Record<BadgeKind, string> = {
  official: "border-accent bg-accent text-on-accent",
  verified: "border-line-strong text-ink",
  unverified: "border-dashed border-line-strong text-muted",
  scripts: "border-invert-bg bg-invert-bg text-invert-fg",
  untested: "border-line-strong bg-bg-sunken text-muted",
};

export function Badge({ kind, children }: { kind: BadgeKind; children?: ReactNode }) {
  return (
    <span className={`hud-label inline-flex h-6 items-center gap-1.5 border px-2 ${styles[kind]}`}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill={kind === "official" ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {icons[kind]}
      </svg>
      {children ?? copy[kind]}
    </span>
  );
}
