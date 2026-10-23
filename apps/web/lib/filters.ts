/** Catalog filter state, shared by the FilterBar and the search logic. */
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
