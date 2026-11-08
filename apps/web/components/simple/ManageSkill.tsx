"use client";

import { AnimatePresence, m } from "framer-motion";
import { useState } from "react";
import { manageCommand, type ManageAction } from "../../lib/install-command";
import { CopyButton } from "../CopyButton";
import { MoreDetails } from "./MoreDetails";
import { EASE } from "./motion";

const TABS: Array<{ id: ManageAction; label: string; title: string; text: string }> = [
  {
    id: "add",
    label: "Add",
    title: "Add it",
    text: "Copy the line, paste it into Terminal and press Enter. It installs the skill and everything it needs. The first time, it can take a couple of minutes.",
  },
  {
    id: "update",
    label: "Update",
    title: "Get the newest version",
    text: "Copy the line, paste it into Terminal and press Enter. You get the latest version. Your own videos and notes stay exactly where they are.",
  },
  {
    id: "remove",
    label: "Remove",
    title: "Take it off your computer",
    text: "Copy the line, paste it into Terminal and press Enter. It asks you to confirm, then deletes the skill. Your own videos stay. You can add it again any time.",
  },
];

const SCOPES = [
  { id: false, label: "Just this folder", hint: "The folder you have open in Claude." },
  {
    id: true,
    label: "All my projects",
    hint: "Use it everywhere. Pick the same one when you update or remove.",
  },
];

/** Add, update or remove in three tabs, each with one line to copy and one sentence about what it does. */
export function ManageSkill({ name }: { name: string }) {
  const [action, setAction] = useState<ManageAction>("add");
  const [everywhere, setEverywhere] = useState(false);
  const tab = TABS.find((t) => t.id === action)!;
  const command = manageCommand(action, name, everywhere);

  return (
    <div className="border border-line-strong bg-bg-raised">
      <div
        role="tablist"
        aria-label="What do you want to do?"
        className="grid grid-cols-3 border-b border-line-strong"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`manage-tab-${t.id}`}
            aria-selected={action === t.id}
            aria-controls="manage-panel"
            onClick={() => setAction(t.id)}
            className={`hud-label relative h-12 font-bold ${
              action === t.id ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {action === t.id && (
              <m.span
                layoutId="manage-underline"
                className="absolute inset-x-0 bottom-0 h-[3px] bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        ))}
      </div>

      <div
        id="manage-panel"
        role="tabpanel"
        aria-labelledby={`manage-tab-${action}`}
        className="p-5 sm:p-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={action}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <h3 className="text-lg">{tab.title}</h3>
            <p className="mt-2 max-w-prose text-sm text-muted">{tab.text}</p>
          </m.div>
        </AnimatePresence>

        <fieldset className="mt-5">
          <legend className="hud-label mb-2 text-muted">Where?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCOPES.map((s) => (
              <label
                key={String(s.id)}
                className={`flex cursor-pointer items-start gap-3 border p-3 text-sm ${
                  everywhere === s.id ? "border-accent bg-bg" : "border-line-strong"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={everywhere === s.id}
                  onChange={() => setEverywhere(s.id)}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  <span className="block font-medium text-ink">{s.label}</span>
                  <span className="block text-muted">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 flex flex-wrap items-stretch border border-line-strong">
          <AnimatePresence mode="wait" initial={false}>
            <m.code
              key={command}
              className="min-w-0 flex-1 basis-64 break-all bg-bg-sunken px-4 py-3 font-mono text-sm text-ink"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <span aria-hidden="true" className="select-none text-accent-ink">
                ${" "}
              </span>
              {command}
            </m.code>
          </AnimatePresence>
          <CopyButton text={command} label="Copy line" />
        </div>
      </div>

      <div className="border-t border-line-strong">
        <MoreDetails title="Where do I paste this?" hint="Terminal, in two clicks">
          <ol className="max-w-prose list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>
              <b className="text-ink">Mac:</b> press <b className="text-ink">⌘ Space</b>, type
              &ldquo;Terminal&rdquo; and press Enter.
            </li>
            <li>
              <b className="text-ink">Windows:</b> press the <b className="text-ink">Windows key</b>
              , type &ldquo;PowerShell&rdquo; and press Enter.
            </li>
            <li>Paste the line (Ctrl or ⌘ + V) and press Enter.</li>
            <li>
              You need <b className="text-ink">Node.js</b> once. It is free: download it from
              nodejs.org, install it, and try again.
            </li>
          </ol>
          <p className="mt-3 max-w-prose text-sm text-muted">
            Prefer not to type? Open Claude Code and ask it to run the line for you.
          </p>
        </MoreDetails>
      </div>
    </div>
  );
}
