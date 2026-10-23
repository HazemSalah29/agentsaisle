"use client";

import { useId, type ReactNode } from "react";

export type Filters = {
  query: string;
  aisles: string[];
  clients: string[];
  source: "all" | "official" | "community";
  verifiedOnly: boolean;
  hideScripts: boolean;
  sort: "popular" | "newest" | "name";
};

export const defaultFilters: Filters = {
  query: "",
  aisles: [],
  clients: [],
  source: "all",
  verifiedOnly: false,
  hideScripts: false,
  sort: "popular",
};

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const control = "h-11 border border-line-strong bg-bg px-3 text-sm text-ink placeholder:text-muted";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`hud-label h-9 border px-3 ${
        on
          ? "border-invert-bg bg-invert-bg text-invert-fg"
          : "border-line-strong text-ink hover:bg-invert-bg hover:text-invert-fg"
      }`}
    >
      {children}
    </button>
  );
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line p-4">
      <legend className="hud-label float-left mb-3 w-full text-muted">{legend}</legend>
      <div className="flex clear-both flex-wrap items-center gap-2">{children}</div>
    </fieldset>
  );
}

export function FilterBar({
  filters,
  onChange,
  aisles,
  clients,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  aisles: string[];
  clients: string[];
}) {
  const id = useId();
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const dirty = JSON.stringify(filters) !== JSON.stringify(defaultFilters);

  return (
    <form
      role="search"
      aria-label="Filter skills"
      onSubmit={(e) => e.preventDefault()}
      className="border border-line-strong bg-bg-raised"
    >
      <div className="flex flex-wrap items-end gap-4 p-4">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
          <label htmlFor={`${id}-q`} className="hud-label text-muted">
            Search skills
          </label>
          <input
            id={`${id}-q`}
            type="search"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Name, description or aisle"
            className={control}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-s`} className="hud-label text-muted">
            Sort by
          </label>
          <select
            id={`${id}-s`}
            value={filters.sort}
            onChange={(e) => set({ sort: e.target.value as Filters["sort"] })}
            className={control}
          >
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <Group legend="Aisle">
        {aisles.map((a) => (
          <Chip
            key={a}
            on={filters.aisles.includes(a)}
            onClick={() => set({ aisles: toggle(filters.aisles, a) })}
          >
            {a}
          </Chip>
        ))}
      </Group>
      <Group legend="Works with">
        {clients.map((c) => (
          <Chip
            key={c}
            on={filters.clients.includes(c)}
            onClick={() => set({ clients: toggle(filters.clients, c) })}
          >
            {c}
          </Chip>
        ))}
      </Group>
      <Group legend="Source">
        {(["all", "official", "community"] as const).map((s) => (
          <label
            key={s}
            className={`hud-label inline-flex h-9 cursor-pointer items-center border px-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
              filters.source === s
                ? "border-invert-bg bg-invert-bg text-invert-fg"
                : "border-line-strong text-ink hover:bg-invert-bg hover:text-invert-fg"
            }`}
          >
            <input
              type="radio"
              name={`${id}-source`}
              value={s}
              checked={filters.source === s}
              onChange={() => set({ source: s })}
              className="sr-only"
            />
            {s}
          </label>
        ))}
      </Group>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line p-4">
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.verifiedOnly}
            onChange={(e) => set({ verifiedOnly: e.target.checked })}
            className="size-4 accent-[var(--accent)]"
          />
          Verified only
        </label>
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.hideScripts}
            onChange={(e) => set({ hideScripts: e.target.checked })}
            className="size-4 accent-[var(--accent)]"
          />
          Hide skills that run scripts
        </label>
        {dirty && (
          <button
            type="button"
            onClick={() => onChange(defaultFilters)}
            className="hud-label ml-auto h-9 px-2 text-accent-ink underline underline-offset-4"
          >
            Clear filters
          </button>
        )}
      </div>
    </form>
  );
}
