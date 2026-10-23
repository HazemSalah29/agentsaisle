import { defaultFilters, type Filters } from "./filters";

type Params = Pick<URLSearchParams, "get" | "getAll">;

const SOURCES = ["all", "official", "community"] as const;
const SORTS = ["popular", "newest", "name"] as const;

/** Read catalog filters from a query string. Unknown or invalid values fall back to defaults. */
export function parseFilters(params: Params): Filters {
  const source = params.get("source");
  const sort = params.get("sort");
  return {
    query: params.get("q") ?? defaultFilters.query,
    aisles: params.getAll("aisle"),
    clients: params.getAll("client"),
    source: (SOURCES as readonly string[]).includes(source ?? "")
      ? (source as Filters["source"])
      : defaultFilters.source,
    verifiedOnly: params.get("verified") === "1",
    hideScripts: params.get("noscripts") === "1",
    sort: (SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as Filters["sort"])
      : defaultFilters.sort,
  };
}

/** The query string for the given filters; defaults are omitted so the plain catalog URL stays clean. */
export function serializeFilters(f: Filters): string {
  const p = new URLSearchParams();
  if (f.query.trim()) p.set("q", f.query);
  f.aisles.forEach((a) => p.append("aisle", a));
  f.clients.forEach((c) => p.append("client", c));
  if (f.source !== defaultFilters.source) p.set("source", f.source);
  if (f.verifiedOnly) p.set("verified", "1");
  if (f.hideScripts) p.set("noscripts", "1");
  if (f.sort !== defaultFilters.sort) p.set("sort", f.sort);
  return p.toString();
}
