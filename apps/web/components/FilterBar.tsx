"use client";

import { useId } from "react";

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

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-9 rounded-sticker border-[1.5px] border-label-rule px-3.5 font-display text-md font-bold ${
        on
          ? "bg-sticker text-on-sticker"
          : "bg-label text-label-ink hover:bg-label-ink hover:text-label"
      }`}
    >
      {children}
    </button>
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
      className="flex flex-col gap-5 rounded-label border-[1.5px] border-label-rule bg-label p-5 text-label-ink shadow-label"
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <label htmlFor={`${id}-q`} className="font-display text-md font-bold">
            Search skills
          </label>
          <input
            id={`${id}-q`}
            type="search"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Name, description or aisle"
            className="min-h-11 rounded-label border-[1.5px] border-label-rule bg-label px-3 text-sm placeholder:text-label-ink-soft"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-s`} className="font-display text-md font-bold">
            Sort by
          </label>
          <select
            id={`${id}-s`}
            value={filters.sort}
            onChange={(e) => set({ sort: e.target.value as Filters["sort"] })}
            className="min-h-11 rounded-label border-[1.5px] border-label-rule bg-label px-3 text-sm"
          >
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-2 font-display text-md font-bold">Aisle</legend>
        {aisles.map((a) => (
          <Chip
            key={a}
            on={filters.aisles.includes(a)}
            onClick={() => set({ aisles: toggle(filters.aisles, a) })}
          >
            {a}
          </Chip>
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-2 font-display text-md font-bold">Works with</legend>
          {clients.map((c) => (
            <Chip
              key={c}
              on={filters.clients.includes(c)}
              onClick={() => set({ clients: toggle(filters.clients, c) })}
            >
              {c}
            </Chip>
          ))}
        </fieldset>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-2 font-display text-md font-bold">Source</legend>
          {(["all", "official", "community"] as const).map((s) => (
            <label
              key={s}
              className={`inline-flex min-h-9 cursor-pointer items-center rounded-sticker border-[1.5px] border-label-rule px-3.5 font-display text-md font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 ${
                filters.source === s ? "bg-sticker text-on-sticker" : "bg-label text-label-ink"
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
              {s === "all" ? "All" : s === "official" ? "Official" : "Community"}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.verifiedOnly}
            onChange={(e) => set({ verifiedOnly: e.target.checked })}
            className="size-5 accent-label-ink"
          />
          Verified only
        </label>
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.hideScripts}
            onChange={(e) => set({ hideScripts: e.target.checked })}
            className="size-5 accent-label-ink"
          />
          Hide skills that run scripts
        </label>
        {dirty && (
          <button
            type="button"
            onClick={() => onChange(defaultFilters)}
            className="ml-auto min-h-9 font-display text-md font-bold underline underline-offset-4"
          >
            Clear filters
          </button>
        )}
      </div>
    </form>
  );
}
