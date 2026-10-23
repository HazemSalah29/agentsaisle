import type { ReactNode } from "react";

export type BadgeKind = "official" | "verified" | "unverified" | "scripts";

const copy: Record<BadgeKind, string> = {
  official: "Official",
  verified: "Verified",
  unverified: "Unverified",
  scripts: "Runs scripts",
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
};

// Badges carry their own colors (label stock) so they read on the page and on cards alike.
const styles: Record<BadgeKind, string> = {
  official: "bg-sticker text-on-sticker border-label-rule",
  verified: "bg-label text-label-ink border-label-rule",
  unverified: "bg-label text-label-ink border-dashed border-label-rule",
  scripts: "bg-label-ink text-label border-label-ink",
};

export function Badge({ kind, children }: { kind: BadgeKind; children?: ReactNode }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1 rounded-label border-[1.5px] px-2 font-display text-xs font-bold leading-none ${styles[kind]}`}
    >
      <svg
        width="14"
        height="14"
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
