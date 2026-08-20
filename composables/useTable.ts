import { computed, onMounted, reactive, toRefs, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import type {
  TableMeta,
  TableResponse,
  PaginationData,
} from "~/types/data-table";
import type { ApiResponse } from "~/composables/useApi";

export interface UseTableOptions {
  defaultPerPage?: number;
  debounce?: number;
  syncUrl?: boolean;
  headers?: Record<string, string> | (() => Record<string, string>);
}

interface TableState<T> {
  data: T[];
  meta: TableMeta | null;
  pagination: PaginationData | null;
  isLoading: boolean;
  hasLoaded: boolean;
  currentPage: number;
  perPage: number;
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  search: string;
  activeFilters: Record<string, Record<string, string>>;
  visibleColumns: string[];
}

export function useTable<T = any>(
  endpoint: string,
  options: UseTableOptions = {},
) {
  const state = reactive({
    data: [] as T[],
    meta: null as TableMeta | null,
    pagination: null as PaginationData | null,
    isLoading: false,
    hasLoaded: false,
    currentPage: 1,
    perPage: options.defaultPerPage ?? 15,
    sortColumn: null as string | null,
    sortDirection: "asc" as "asc" | "desc",
    search: "",
    activeFilters: {} as Record<string, Record<string, string>>,
    visibleColumns: [] as string[],
  }) as TableState<T>;
  const isEmpty = computed(() => !state.isLoading && state.data.length === 0);
  const api = useApi();
  const { effectiveLocale } = useLocalePreference();

  function initFromUrl() {
    if (!options.syncUrl || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("page")) state.currentPage = Number(params.get("page"));
    if (params.get("limit")) state.perPage = Number(params.get("limit"));
    if (params.get("sort")) {
      const [col, dir] = params.get("sort")!.split(":");
      state.sortColumn = col;
      state.sortDirection = (dir as "asc" | "desc") || "asc";
    }
    if (params.get("search")) state.search = params.get("search")!;
    params.forEach((value, key) => {
      const match = key.match(/^filters\[(\w+)]\[(\w+)]$/);
      if (match) {
        const [, filterKey, clause] = match;
        if (!state.activeFilters[filterKey])
          state.activeFilters[filterKey] = {};
        state.activeFilters[filterKey][clause] = value;
      }
    });
  }

  function buildQueryString(): string {
    const params = new URLSearchParams();
    params.set("page", String(state.currentPage));
    params.set("limit", String(state.perPage));
    if (state.sortColumn)
      params.set("sort", `${state.sortColumn}:${state.sortDirection}`);
    if (state.search) params.set("search", state.search);
    for (const [key, clauseMap] of Object.entries(state.activeFilters)) {
      for (const [clause, value] of Object.entries(clauseMap)) {
        params.set(`filters[${key}][${clause}]`, value);
      }
    }
    if (state.visibleColumns.length > 0) {
      params.set("columns", state.visibleColumns.join(","));
    }
    return params.toString();
  }

  function syncToUrl() {
    if (!options.syncUrl || typeof window === "undefined") return;
    const queryString = buildQueryString();
    const url = `${window.location.pathname}?${queryString}`;
    window.history.replaceState({}, "", url);
  }

  async function fetchData() {
    state.isLoading = true;
    try {
      const queryString = buildQueryString();
      const headers =
        typeof options.headers === "function"
          ? options.headers()
          : options.headers;
      const envelope = await api.get<ApiResponse<TableResponse<T>>>(
        `${endpoint}/data?${queryString}`,
        headers ? { headers } : {},
      );
      const result = (envelope?.data ?? null) as TableResponse<T> | null;
      if (!result) {
        throw new Error("Table response was empty");
      }
      state.data = result.data;
      state.meta = result.meta;
      state.pagination = result.pagination;
      if (state.visibleColumns.length === 0 && result.meta?.columns?.length) {
        state.visibleColumns = result.meta.columns
          .filter((c: any) => c.toggleable !== false && c.visible !== false)
          .map((c: any) => c.key);
      }
    } catch (error) {
      console.error("Failed to fetch table data:", error);
    } finally {
      state.isLoading = false;
      state.hasLoaded = true;
    }
  }

  const debouncedFetch = useDebounceFn(() => {
    syncToUrl();
    void fetchData();
  }, options.debounce ?? 300);

  function setPage(page: number) {
    state.currentPage = page;
    syncToUrl();
    void fetchData();
  }

  function setPerPage(value: number) {
    state.perPage = value;
    state.currentPage = 1;
    syncToUrl();
    void fetchData();
  }

  function setSort(column: string) {
    if (state.sortColumn === column) {
      state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    } else {
      state.sortColumn = column;
      state.sortDirection = "asc";
    }
    state.currentPage = 1;
    syncToUrl();
    void fetchData();
  }

  function setSearch(value: string) {
    state.search = value;
    state.currentPage = 1;
    debouncedFetch();
  }

  function addFilter(key: string, clause: string, value: string) {
    if (!state.activeFilters[key]) state.activeFilters[key] = {};
    state.activeFilters[key][clause] = value;
    state.currentPage = 1;
    debouncedFetch();
  }

  function removeFilter(key: string) {
    delete state.activeFilters[key];
    state.currentPage = 1;
    debouncedFetch();
  }

  function updateFilter(key: string, clause: string, value: string) {
    state.activeFilters[key] = { [clause]: value };
    state.currentPage = 1;
    debouncedFetch();
  }

  function toggleColumn(key: string) {
    const idx = state.visibleColumns.indexOf(key);
    if (idx >= 0) {
      state.visibleColumns.splice(idx, 1);
    } else {
      state.visibleColumns.push(key);
    }
  }

  function refresh() {
    void fetchData();
  }

  onMounted(() => {
    initFromUrl();
    fetchData();
  });

  // Table headers, filters, empty states, and action confirmations are
  // supplied by the API, so refresh their metadata after a locale switch.
  watch(effectiveLocale, (nextLocale, previousLocale) => {
    if (nextLocale !== previousLocale && state.hasLoaded) void fetchData();
  });

  return {
    ...toRefs(state),
    isEmpty,
    setPage,
    setPerPage,
    setSort,
    setSearch,
    addFilter,
    removeFilter,
    updateFilter,
    toggleColumn,
    refresh,
  };
}
