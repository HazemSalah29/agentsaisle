"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { parseFilters, serializeFilters } from "../lib/filter-url";
import { defaultFilters, type Filters } from "../lib/filters";
import { applyFilters, filterOptions, type CatalogSkill } from "../lib/search";
import { FilterBar } from "./FilterBar";
import { SkillCard } from "./SkillCard";

/** Search, filter and sort over the whole (small) index in the browser. State lives in the URL. */
export function Catalog({ skills }: { skills: CatalogSkill[] }) {
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => parseFilters(params));
  const options = useMemo(() => filterOptions(skills), [skills]);
  const results = useMemo(() => applyFilters(skills, filters), [skills, filters]);

  // Keep the address bar shareable without adding a history entry per keystroke.
  useEffect(() => {
    const qs = serializeFilters(filters);
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [filters]);

  return (
    <div className="space-y-6 px-4 pb-14 sm:px-8">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        aisles={options.aisles}
        clients={options.clients}
      />
      <p role="status" aria-live="polite" className="hud-label text-muted">
        {results.length} of {skills.length} {skills.length === 1 ? "skill" : "skills"}
      </p>
      {results.length === 0 ? (
        <div className="border border-line-strong bg-bg-raised p-8">
          <p className="font-display text-lg text-ink-strong">No skills match</p>
          <p className="mt-2 text-sm text-muted">Try fewer words or remove a filter.</p>
          <button
            type="button"
            onClick={() => setFilters(defaultFilters)}
            className="hud-label mt-5 h-11 bg-invert-bg px-5 font-bold text-invert-fg hover:opacity-80"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="grid border-l border-t border-line-strong sm:grid-cols-2 xl:grid-cols-3">
          {results.map((s) => (
            <li key={s.name} className="border-b border-r border-line-strong bg-bg-raised">
              <SkillCard skill={s} href={`/skills/${s.name}`} stars={s.stars} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
