import type { Metadata } from "next";
import { REPO_URL } from "../../lib/site";

export const metadata: Metadata = { title: "Submit a skill" };

export default function SubmitPage() {
  return (
    <div className="px-4 py-14 sm:px-8">
      <p className="hud-label text-accent-ink">Submit</p>
      <h1 className="mt-3 text-3xl">List your skill</h1>
      <p className="mt-4 text-md text-muted">
        Skills are listed through a pull request that adds one YAML file to{" "}
        <code className="font-mono">registry/community/</code>. A guided form that writes the file
        for you is coming next. Until then, the format is in the repository.
      </p>
      <a
        href={`${REPO_URL}/tree/main/registry/community`}
        rel="noopener noreferrer"
        className="hud-label mt-6 inline-flex h-11 items-center bg-invert-bg px-6 font-bold text-invert-fg hover:opacity-80"
      >
        See the examples on GitHub
      </a>
    </div>
  );
}
