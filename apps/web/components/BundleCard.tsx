import type { Profile } from "@agentsaisle/registry-schema";
import { bundleCommand, initCommand } from "../lib/install-command";
import { CopyButton } from "./CopyButton";

/** A starter bundle with the two ways to install it. */
export function BundleCard({ profile }: { profile: Profile }) {
  const init = initCommand(profile.id);
  return (
    <article className="flex h-full flex-col bg-bg-raised p-5">
      <h3 className="text-lg">{profile.name}</h3>
      <p className="mt-2 text-sm text-muted">{profile.description}</p>
      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills in this bundle">
        {profile.skills.map((s) => (
          <li key={s} className="hud-label border border-line px-2 py-1 text-ink">
            {s}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-5">
        <p className="hud-label text-muted">Install the bundle</p>
        <code className="mt-2 block break-all bg-bg-sunken px-3 py-2.5 font-mono text-sm">
          {init}
        </code>
        <div className="mt-2 border border-line-strong">
          <CopyButton text={init} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Or skill by skill:{" "}
          <span className="font-mono break-all">{bundleCommand(profile.skills)}</span>
        </p>
      </div>
    </article>
  );
}
