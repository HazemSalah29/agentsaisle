import { bundleCommand } from "../lib/install-command";
import { CopyButton } from "./CopyButton";

export type ReceiptItem = { name: string; version: string };

/**
 * A bundle shown as a ledger, ending in one install command like the total on a receipt.
 * `newest` marks the item that was just added, so only it flashes.
 */
export function Receipt({
  items,
  date,
  newest,
}: {
  items: ReceiptItem[];
  date: string;
  newest?: string;
}) {
  const command = bundleCommand(items.map((i) => i.name));
  return (
    <div className="w-full max-w-md border border-line-strong bg-bg-raised font-mono text-sm">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <p className="hud-label text-ink-strong">Your bundle</p>
        <p className="hud-label text-muted">{date}</p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-muted">Nothing here yet. Add a skill to start your bundle.</p>
      ) : (
        <ol className="divide-y divide-line">
          {items.map((i, n) => (
            <li
              key={i.name}
              className={`flex items-baseline gap-3 px-4 py-2.5 ${i.name === newest ? "animate-flash-in" : ""}`}
            >
              <span className="w-6 text-muted">{String(n + 1).padStart(2, "0")}</span>
              <span className="text-ink-strong">{i.name}</span>
              <span
                aria-hidden="true"
                className="min-w-4 flex-1 -translate-y-1 border-b border-dotted border-line-strong"
              />
              <span className="text-muted">{i.version}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex justify-between border-t border-line-strong px-4 py-3">
        <span className="hud-label text-muted">Skills</span>
        <span className="text-ink-strong">{items.length}</span>
      </div>
      <div className="border-t border-line bg-bg-sunken px-4 py-3">
        <p className="hud-label text-muted">Run this to install the lot</p>
        <code className="mt-2 block break-words text-ink">{command}</code>
      </div>
      {items.length > 0 && (
        <div className="border-t border-line">
          <CopyButton text={command} label="Copy command" />
        </div>
      )}
    </div>
  );
}
