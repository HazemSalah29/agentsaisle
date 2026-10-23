"use client";

import { useId, useState } from "react";
import { installCommand } from "../lib/install-command";
import { CopyButton } from "./CopyButton";

export function InstallCommand({ name, versions }: { name: string; versions: string[] }) {
  const id = useId();
  const latest = versions[0];
  const [version, setVersion] = useState(latest);
  const command = installCommand(name, version, latest);

  return (
    <div className="relative border-[1.5px] border-label-rule bg-label p-4 text-label-ink shadow-label rounded-label">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {versions.length > 1 && (
          <div className="flex flex-col gap-1">
            <label htmlFor={id} className="font-display text-md font-bold">
              Version
            </label>
            <select
              id={id}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="min-h-11 rounded-label border-[1.5px] border-label-rule bg-label px-3 font-mono text-sm"
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
        <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1">
          <span className="font-display text-md font-bold">Install</span>
          <code className="block min-h-11 break-all rounded-label bg-label-ink px-4 py-2.5 font-mono text-sm text-label">
            <span aria-hidden="true" className="select-none text-sticker">
              ${" "}
            </span>
            {command}
          </code>
        </div>
        <CopyButton text={command} />
      </div>
    </div>
  );
}
