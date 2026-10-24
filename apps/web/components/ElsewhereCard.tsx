import type { ElsewhereEntry } from "@agentsaisle/registry-schema";
import { elsewhereUrl } from "../lib/links";

/** A skill by another author. We link to it; we do not host or install it. */
export function ElsewhereCard({ entry }: { entry: ElsewhereEntry }) {
  return (
    <article className="relative flex h-full flex-col gap-3 bg-bg-raised p-5">
      <h3 className="text-lg">
        <a
          href={elsewhereUrl(entry)}
          rel="noopener noreferrer"
          className="after:absolute after:inset-0"
        >
          {entry.name}
        </a>
      </h3>
      <p className="text-sm text-muted">{entry.description}</p>
      <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="hud-label text-muted">By</dt>
          <dd>{entry.author}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="hud-label text-muted">License</dt>
          <dd>{entry.license}</dd>
        </div>
      </dl>
      <p className="hud-label flex items-center justify-between border-t border-line pt-3 text-ink">
        <span>Open on GitHub</span>
        <span aria-hidden="true">↗</span>
      </p>
    </article>
  );
}
