import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profiles" };

export default function ProfilesPage() {
  return (
    <div className="px-4 py-14 sm:px-8">
      <p className="hud-label text-accent-ink">Profiles</p>
      <h1 className="mt-3 text-3xl">Pick a starter bundle</h1>
      <p className="mt-4 text-md text-muted">
        Answer a few questions and get a bundle of skills with one command that installs them all.
        This is coming next. In the meantime, browse the catalog and install skills one at a time.
      </p>
      <a
        href="/skills"
        className="hud-label mt-6 inline-flex h-11 items-center bg-invert-bg px-6 font-bold text-invert-fg hover:opacity-80"
      >
        Browse skills
      </a>
    </div>
  );
}
