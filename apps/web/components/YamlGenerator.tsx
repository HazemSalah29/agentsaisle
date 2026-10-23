"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  emptyDraft,
  entryToYaml,
  fieldErrors,
  newFileUrl,
  type EntryDraft,
} from "../lib/yaml-entry";
import { CopyButton } from "./CopyButton";

const CLIENTS: Array<[string, string]> = [
  ["claude-code", "Claude Code"],
  ["codex", "Codex"],
  ["cursor", "Cursor"],
];

const input =
  "h-11 w-full border border-line-strong bg-bg px-3 text-sm text-ink placeholder:text-muted aria-[invalid=true]:border-accent-ink";

function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  className?: string;
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={htmlFor} className="hud-label text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-accent-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Builds the community YAML entry from a form and checks it with the same schema CI uses. */
export function YamlGenerator() {
  const id = useId();
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft);
  const [categoryText, setCategoryText] = useState("");
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const errors = useMemo(() => fieldErrors(draft), [draft]);
  const yaml = useMemo(() => entryToYaml(draft), [draft]);
  const valid = Object.keys(errors).length === 0;
  const show = (key: string) => (touched.has(key) ? errors[key] : undefined);
  const touch = (key: string) => setTouched((t) => new Set(t).add(key));

  const set = (patch: Partial<EntryDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setVersion = (i: number, patch: Partial<EntryDraft["versions"][number]>) =>
    setDraft((d) => ({
      ...d,
      versions: d.versions.map((v, n) => (n === i ? { ...v, ...patch } : v)),
    }));

  const owner = draft.repo.split("/")[0];

  function text(key: keyof EntryDraft & string, label: string, placeholder: string, hint?: string) {
    const fid = `${id}-${key}`;
    return (
      <Field label={label} hint={hint} error={show(key)} htmlFor={fid}>
        <input
          id={fid}
          value={draft[key] as string}
          placeholder={placeholder}
          onChange={(e) => set({ [key]: e.target.value } as Partial<EntryDraft>)}
          onBlur={() => touch(key)}
          aria-invalid={show(key) ? true : undefined}
          aria-describedby={show(key) ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
          autoComplete="off"
          spellCheck={false}
          className={input}
        />
      </Field>
    );
  }

  return (
    <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[1fr_26rem]">
      <form onSubmit={(e) => e.preventDefault()} aria-label="Community entry" className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {text(
            "name",
            "Skill name",
            "reel-scriptwriter",
            "Lowercase, hyphens. Must match name in your SKILL.md.",
          )}
          {text("author", "Author", "github-username")}
          {text("repo", "GitHub repository", "owner/repo", "A public repository.")}
          {text("path", "Folder with SKILL.md", "skills/reel-scriptwriter")}
        </div>

        <fieldset className="space-y-4 border border-line-strong bg-bg-raised p-4">
          <legend className="hud-label px-1 text-muted">Versions</legend>
          {draft.versions.map((v, i) => (
            <div
              key={i}
              className="grid gap-4 border-b border-line pb-4 last:border-b-0 last:pb-0 sm:grid-cols-2"
            >
              {(["version", "ref", "sha"] as const).map((k) => {
                const key = `versions.${i}.${k}`;
                const fid = `${id}-${key}`;
                const labels = { version: "Version", ref: "Tag or branch", sha: "Full commit SHA" };
                const placeholders = { version: "1.0.0", ref: "v1.0.0", sha: "40 characters" };
                const hint =
                  k === "sha" && owner
                    ? `Find it with: git ls-remote https://github.com/${draft.repo} ${v.ref || "<ref>"}`
                    : undefined;
                return (
                  <Field
                    key={k}
                    className={k === "sha" ? "sm:col-span-2" : undefined}
                    label={`${labels[k]}${i > 0 ? ` (${i + 1})` : ""}`}
                    hint={hint}
                    error={show(key)}
                    htmlFor={fid}
                  >
                    <input
                      id={fid}
                      value={v[k]}
                      placeholder={placeholders[k]}
                      onChange={(e) => setVersion(i, { [k]: e.target.value })}
                      onBlur={() => touch(key)}
                      aria-invalid={show(key) ? true : undefined}
                      aria-describedby={
                        show(key) ? `${fid}-error` : hint ? `${fid}-hint` : undefined
                      }
                      autoComplete="off"
                      spellCheck={false}
                      className={`${input} ${k === "sha" ? "font-mono" : ""}`}
                    />
                  </Field>
                );
              })}
              {draft.versions.length > 1 && (
                <button
                  type="button"
                  onClick={() => set({ versions: draft.versions.filter((_, n) => n !== i) })}
                  className="hud-label h-9 justify-self-start px-1 text-accent-ink underline underline-offset-4 sm:col-span-2"
                >
                  Remove version {v.version || i + 1}
                </button>
              )}
            </div>
          ))}
          {draft.versions.length < 5 && (
            <button
              type="button"
              onClick={() =>
                set({ versions: [...draft.versions, { version: "", ref: "", sha: "" }] })
              }
              className="hud-label h-10 border border-line-strong px-4 hover:bg-invert-bg hover:text-invert-fg"
            >
              Add an older version
            </button>
          )}
          <p className="text-xs text-muted">
            List the newest version first or last, either works. The newest is used as the latest.
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Aisles"
            hint="Comma separated, for example video, social."
            error={show("category")}
            htmlFor={`${id}-category`}
          >
            <input
              id={`${id}-category`}
              value={categoryText}
              placeholder="video, social"
              onChange={(e) => {
                setCategoryText(e.target.value);
                set({
                  category: e.target.value
                    .split(",")
                    .map((c) => c.trim().toLowerCase())
                    .filter(Boolean),
                });
              }}
              onBlur={() => touch("category")}
              aria-invalid={show("category") ? true : undefined}
              aria-describedby={`${id}-category-${show("category") ? "error" : "hint"}`}
              className={input}
            />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="hud-label mb-1.5 text-muted">Works with</legend>
            <div className="flex flex-wrap gap-2">
              {CLIENTS.map(([value, label]) => (
                <label
                  key={value}
                  className="hud-label inline-flex min-h-10 cursor-pointer items-center gap-2 border border-line-strong px-3 has-[:checked]:border-invert-bg has-[:checked]:bg-invert-bg has-[:checked]:text-invert-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={draft.clients.includes(value)}
                    onChange={() => {
                      touch("clients");
                      set({
                        clients: draft.clients.includes(value)
                          ? draft.clients.filter((c) => c !== value)
                          : [...draft.clients, value],
                      });
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            {show("clients") && <p className="text-sm text-accent-ink">{show("clients")}</p>}
          </fieldset>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={draft.runs_scripts}
            onChange={(e) => set({ runs_scripts: e.target.checked })}
            className="mt-1 size-4 accent-[var(--accent)]"
          />
          <span>
            <strong>This skill includes scripts.</strong> Tick this if the skill has a{" "}
            <code className="font-mono">scripts/</code> folder. The check fails if it does and this
            is not ticked.
          </span>
        </label>
      </form>

      <div className="lg:sticky lg:top-16 lg:self-start">
        <div className="border border-line-strong bg-bg-raised">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="hud-label text-muted">
              registry/community/{draft.name || "your-skill"}.yaml
            </p>
          </div>
          <pre
            tabIndex={0}
            aria-label="Generated YAML"
            className="max-h-96 overflow-auto bg-bg-sunken p-4 font-mono text-xs leading-relaxed text-ink"
          >
            {yaml}
          </pre>
          <div className="flex flex-wrap items-stretch border-t border-line">
            <CopyButton text={yaml} label="Copy YAML" />
            {valid ? (
              <a
                href={newFileUrl(draft.name, yaml)}
                target="_blank"
                rel="noopener noreferrer"
                className="hud-label flex h-11 flex-1 items-center justify-center bg-accent px-5 font-bold text-on-accent hover:opacity-90"
              >
                Open a pull request
              </a>
            ) : (
              <span
                role="link"
                aria-disabled="true"
                className="hud-label flex h-11 flex-1 items-center justify-center px-5 text-muted"
              >
                Fix the fields to continue
              </span>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted" aria-live="polite">
          {valid
            ? "Looks valid. A check on GitHub will also confirm your repository, commit and SKILL.md."
            : Object.keys(errors).length === 1
              ? "1 field still needs attention."
              : `${Object.keys(errors).length} fields still need attention.`}
        </p>
      </div>
    </div>
  );
}
