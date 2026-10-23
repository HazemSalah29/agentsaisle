"use client";

import { useState } from "react";
import { FilterBar, defaultFilters, type Filters } from "../../components/FilterBar";
import { Receipt, type ReceiptItem } from "../../components/Receipt";

export function FilterBarDemo() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  return (
    <FilterBar
      filters={filters}
      onChange={setFilters}
      aisles={["code", "design", "git", "writing", "video"]}
      clients={["Claude Code", "Codex", "Cursor"]}
    />
  );
}

const shelf: ReceiptItem[] = [
  { name: "plan", version: "1.0.0" },
  { name: "implement", version: "1.0.0" },
  { name: "explore", version: "1.0.0" },
  { name: "review", version: "1.0.0" },
  { name: "commit", version: "1.0.0" },
];

export function ReceiptDemo({ date }: { date: string }) {
  const [items, setItems] = useState<ReceiptItem[]>([shelf[2]!]);
  const [newest, setNewest] = useState<string>();
  const add = (item: ReceiptItem) => {
    setItems((cur) => [...cur, item]);
    setNewest(item.name);
  };
  const left = shelf.filter((s) => !items.some((i) => i.name === s.name));

  return (
    <div className="flex flex-wrap items-start gap-10">
      <Receipt items={items} date={date} newest={newest} />
      <div className="flex max-w-sm flex-col gap-3">
        <p className="font-display text-xl font-bold">Add skills to the bag</p>
        <div className="flex flex-wrap gap-2">
          {left.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => add(s)}
              className="min-h-11 rounded-sticker border-[1.5px] border-ink px-4 font-display text-md font-bold hover:bg-ink hover:text-bag"
            >
              Add {s.name}
            </button>
          ))}
          {left.length === 0 && <p className="text-ink-soft">Everything is in the bag.</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            setItems([]);
            setNewest(undefined);
          }}
          disabled={items.length === 0}
          className="min-h-11 self-start font-display text-md font-bold underline underline-offset-4 disabled:opacity-50"
        >
          Empty the bag
        </button>
      </div>
    </div>
  );
}
