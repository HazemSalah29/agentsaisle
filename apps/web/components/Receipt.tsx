import { bundleCommand } from "../lib/install-command";
import { CopyButton } from "./CopyButton";

export type ReceiptItem = { name: string; version: string };

/**
 * A bundle printed as a till receipt. The install command sits at the bottom like the total.
 * `newest` marks the item that was just added, so only it slides on.
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
    <div className="relative max-w-sm [filter:drop-shadow(3px_3px_0_var(--edge))]">
      <div className="torn-edge bg-thermal px-6 pb-12 pt-6 font-mono text-sm text-thermal-ink ">
        <p className="font-display text-2xl font-black leading-none">Agent Aisle</p>
        <p className="mt-1 text-xs text-thermal-ink-soft">Your bundle, {date}</p>
        <hr className="my-4 border-t-2 border-dashed border-thermal-ink" />
        {items.length === 0 ? (
          <p className="py-4 text-thermal-ink-soft">
            Nothing in the bag yet. Add a skill to start your bundle.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((i) => (
              <li
                key={i.name}
                className={`flex items-baseline gap-2 ${i.name === newest ? "animate-slide-on" : ""}`}
              >
                <span className="font-medium">{i.name}</span>
                <span
                  aria-hidden="true"
                  className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-thermal-ink-soft"
                />
                <span>{i.version}</span>
              </li>
            ))}
          </ul>
        )}
        <hr className="my-4 border-t-2 border-dashed border-thermal-ink" />
        <div className="flex justify-between font-medium">
          <span>Skills</span>
          <span>{items.length}</span>
        </div>
        <p className="mt-4 text-xs text-thermal-ink-soft">Run this to install the lot:</p>
        <code className="mt-1 block break-words border-2 border-thermal-ink px-3 py-2 text-sm">
          {command}
        </code>
        {items.length > 0 && (
          <div className="relative mt-4">
            <CopyButton text={command} label="Copy command" />
          </div>
        )}
      </div>
    </div>
  );
}
