"use client";

import { useId, useState } from "react";
import { installCommand } from "../lib/install-command";
import { CopyButton } from "./CopyButton";

/** The install command in a terminal bar, with a version selector when there is more than one. */
export function InstallCommand({ name, versions }: { name: string; versions: string[] }) {
  const id = useId();
  const latest = versions[0];
  const [version, setVersion] = useState(latest);
  const command = installCommand(name, version, latest);

  return (
    <div className="border border-line-strong bg-bg-raised">
      <div className="flex flex-wrap items-center justify-between gap-x-4 border-b border-line px-4 py-2">
        <p className="hud-label text-muted">Install {name}</p>
        {versions.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor={id} className="hud-label text-muted">
              Version
            </label>
            <select
              id={id}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="h-8 border border-line-strong bg-bg px-2 font-mono text-sm text-ink"
            >
              {versions.map((v, i) => (
                <option key={v} value={v}>
                  {v}
                  {i === 0 ? " (latest)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-stretch">
        <code className="min-w-0 flex-1 basis-64 break-all bg-bg-sunken px-4 py-3 font-mono text-sm text-ink">
          <span aria-hidden="true" className="select-none text-accent-ink">
            ${" "}
          </span>
          {command}
        </code>
        <CopyButton text={command} />
      </div>
    </div>
  );
}
