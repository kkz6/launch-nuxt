<script setup lang="ts">
import { computed, useSlots } from "vue";
import { cn } from "~/utils";
import { useTable } from "~/composables/useTable";
import { useActions } from "~/composables/useActions";
import { useExport } from "~/composables/useExport";
import { useStickyTable } from "~/composables/useStickyTable";
import { Checkbox } from "~/components/ui/checkbox";
import { CellRenderer } from "./columns";
import { AddFilterDropdown, ActiveFilters } from "./filters";
import { RowActions, BulkActionsDropdown } from "./actions";
import SearchInput from "./SearchInput.vue";
import ToggleColumnsDropdown from "./ToggleColumnsDropdown.vue";
import TablePagination from "./TablePagination.vue";
import EmptyState from "./EmptyState.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import ExportButton from "./ExportButton.vue";
import ExportProgressOverlay from "./ExportProgressOverlay.vue";

const props = withDefaults(
  defineProps<{
    endpoint: string;
    defaultPerPage?: number;
    debounce?: number;
    syncUrl?: boolean;
    tableClass?: string;
    headers?: Record<string, string> | (() => Record<string, string>);
    // Optional per-row filter for the server-declared actions. Lets a page
    // hide actions the current user isn't allowed to invoke (the backend is
    // the real gate via 403, this is purely UX). Returns the actions to show.
    rowActionsFilter?: (actions: any[], row: any) => any[];
  }>(),
  {
    defaultPerPage: 15,
    debounce: 300,
    syncUrl: true,
    tableClass: "",
    headers: () => ({}),
    rowActionsFilter: undefined,
  },
);

const emit = defineEmits<{
  "row-click": [row: any];
}>();

const {
  data,
  meta,
  pagination,
  isLoading,
  hasLoaded,
  isEmpty,
  sortColumn,
  sortDirection,
  search,
  activeFilters,
  visibleColumns,
  setPage,
  setPerPage,
  setSort,
  setSearch,
  addFilter,
  removeFilter,
  updateFilter,
  toggleColumn,
  refresh,
} = useTable(props.endpoint, {
  defaultPerPage: props.defaultPerPage,
  debounce: props.debounce,
  syncUrl: props.syncUrl,
  headers: props.headers,
});

const {
  selectedIds,
  hasSelection,
  selectedCount,
  confirmAction,
  toggleSelect,
  toggleSelectAll,
  executeAction,
  executeConfirmedAction,
  cancelAction,
} = useActions(`${props.endpoint}/action`);

const { isExporting, exportProgress, triggerExport } = useExport();
const { tableRef, headerStuck } = useStickyTable();
const slots = useSlots();

// Skip the action column entirely when no row on the current page has a
// visible action (e.g. a Roles table where Delete is hidden for every
// system role) — leaves no orphan "Actions" header above empty cells.
// A client-injected `#row-actions` slot (e.g. Spectate) also keeps the
// column alive, since those actions exist on every row regardless of the
// server-declared `_actions`.
function rowActions(row: any): any[] {
  const actions = row._actions ?? [];
  return props.rowActionsFilter
    ? props.rowActionsFilter(actions, row)
    : actions;
}

const anyRowHasActions = computed(() => {
  if (slots["row-actions"]) return true;
  return data.value.some((item: any) =>
    rowActions(item).some((a: any) => !a.hidden),
  );
});

const visibleColumnDefs = computed(() => {
  if (!meta.value) return [];
  return meta.value.columns.filter((c) => {
    if (c.type === "action") return anyRowHasActions.value;
    // Non-toggleable columns (id, select, etc.) always render. The action
    // column is handled above. Everything else is gated by the toggle list,
    // which is seeded with the initially-visible columns by useTable.
    if (c.toggleable === false) return c.visible;
    return visibleColumns.value.includes(c.key);
  });
});

// Until the first fetch settles there are no rows and no meta yet; render a
// skeleton table so the card keeps its shape instead of collapsing to a blank
// box. Keyed on hasLoaded (not isLoading) so the skeleton shows from the very
// first render — including SSR and the tick before onMounted fires the fetch —
// rather than briefly flashing an (config-less) empty state.
const isInitialLoading = computed(() => !hasLoaded.value);
const skeletonColCount = computed(() => visibleColumnDefs.value.length || 5);
const skeletonRowCount = computed(() =>
  Math.min(props.defaultPerPage ?? 10, 10),
);
const skeletonWidths = ["70%", "45%", "60%", "35%", "55%", "50%"];

const hasBulkActions = computed(
  () => (meta.value?.actions.bulk.length ?? 0) > 0,
);
const hasExports = computed(() => (meta.value?.exports.length ?? 0) > 0);
const showCheckboxes = computed(() => hasBulkActions.value || hasExports.value);
const allIds = computed(() => data.value.map((item: any) => String(item.id)));
const allSelected = computed(
  () =>
    allIds.value.length > 0 && selectedIds.value.size === allIds.value.length,
);

async function handleRowAction(action: any, row: any) {
  // A "view" action is a frontend-only signal — open the same sheet that
  // a row click would. Skip the action endpoint entirely.
  if (action.name === "view") {
    emit("row-click", row);
    return;
  }
  await executeAction(props.tableClass || "", action, { id: String(row.id) });
  // Skip refresh on link-type actions (we navigated away) and confirm-required
  // actions (handleConfirm refreshes after the dialog resolves).
  if (action.type !== "link" && !action.confirm) refresh();
}

async function handleBulkAction(action: any) {
  await executeAction(props.tableClass || "", action, {
    ids: Array.from(selectedIds.value),
  });
  if (action.type !== "link" && !action.confirm) refresh();
}

function handleExport(exportDef: any) {
  triggerExport(props.tableClass || "", exportDef.name);
}

async function handleConfirm() {
  await executeConfirmedAction(props.tableClass || "");
  refresh();
}

// Allow parents to imperatively reload after editing a row in a sheet
// (so the table reflects the saved change without a full page reload).
defineExpose({ refresh });
</script>
<template>
  <div ref="tableRef" class="w-full">
    <!-- Header toolbar -->
    <div class="flex flex-wrap items-center gap-2 pb-4">
      <SearchInput
        v-if="meta?.search.enabled"
        :model-value="search"
        :placeholder="meta.search.placeholder"
        class="w-64"
        @update:model-value="setSearch"
      />

      <BulkActionsDropdown
        v-if="hasSelection"
        :actions="meta?.actions.bulk ?? []"
        :exports="meta?.exports ?? []"
        :selected-count="selectedCount"
        @action="handleBulkAction"
        @export="handleExport"
      />

      <div class="flex-1" />

      <AddFilterDropdown
        v-if="meta?.filters.length"
        :filters="meta.filters"
        :active-filter-keys="Object.keys(activeFilters)"
        @add="
          (key) =>
            addFilter(
              key,
              meta!.filters.find((f) => f.key === key)!.clauses[0],
              '',
            )
        "
      />

      <ToggleColumnsDropdown
        v-if="meta?.columns.some((c) => c.toggleable)"
        :columns="meta.columns"
        :visible-columns="visibleColumns"
        @toggle="toggleColumn"
      />

      <ExportButton
        v-if="meta?.exports.length"
        :exports="meta.exports"
        @export="handleExport"
      />
    </div>

    <!-- Active filters -->
    <ActiveFilters
      v-if="Object.keys(activeFilters).length > 0 && meta"
      :filters="meta.filters"
      :active-filters="activeFilters"
      class="mb-4"
      @update="(key, clause, value) => updateFilter(key, clause, value)"
      @remove="removeFilter"
    />

    <!-- Table -->
    <div class="rounded-xl border bg-card overflow-hidden">
      <div class="relative overflow-auto">
        <table
          class="w-full text-sm"
          style="border-collapse: collapse; border: none"
        >
          <thead
            :class="
              cn(
                'border-b bg-muted/30',
                meta?.stickyHeader &&
                  headerStuck &&
                  'sticky top-0 z-10 shadow-sm',
              )
            "
          >
            <tr v-if="isInitialLoading && !visibleColumnDefs.length">
              <th
                v-for="i in skeletonColCount"
                :key="`skh-${i}`"
                class="px-4 py-2.5 text-left"
              >
                <div class="h-3 w-20 animate-pulse rounded bg-muted" />
              </th>
            </tr>
            <tr v-else>
              <th v-if="showCheckboxes" class="w-10 pl-4 pr-2 py-2.5">
                <Checkbox
                  :model-value="allSelected"
                  @update:model-value="toggleSelectAll(allIds)"
                />
              </th>
              <th
                v-for="col in visibleColumnDefs"
                :key="col.key"
                :class="
                  cn(
                    'px-4 py-2.5 text-xs font-medium text-muted-foreground',
                    col.alignment === 'right'
                      ? 'text-right'
                      : col.alignment === 'center'
                        ? 'text-center'
                        : 'text-left',
                    col.headerClass,
                  )
                "
                class="cursor-default"
                @click="col.sortable && setSort(col.key)"
              >
                <div
                  class="flex items-center gap-1"
                  :class="[
                    {
                      'cursor-pointer select-none hover:text-foreground':
                        col.sortable,
                    },
                    col.alignment === 'right'
                      ? 'justify-end'
                      : col.alignment === 'center'
                        ? 'justify-center'
                        : 'justify-start',
                  ]"
                >
                  {{ col.header }}
                  <template v-if="col.sortable">
                    <svg
                      v-if="sortColumn === col.key && sortDirection === 'asc'"
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                    >
                      <path d="m5 15 7-7 7 7" />
                    </svg>
                    <svg
                      v-else-if="
                        sortColumn === col.key && sortDirection === 'desc'
                      "
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                    >
                      <path d="m19 9-7 7-7-7" />
                    </svg>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      class="opacity-30"
                    >
                      <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
                    </svg>
                  </template>
                </div>
              </th>
            </tr>
          </thead>
          <tbody
            v-if="isInitialLoading"
            class="[&>tr:not(:last-child)]:border-b"
          >
            <tr v-for="n in skeletonRowCount" :key="`sk-${n}`">
              <td v-if="showCheckboxes" class="pl-4 pr-2 py-3">
                <div class="h-4 w-4 animate-pulse rounded bg-muted" />
              </td>
              <td
                v-for="i in skeletonColCount"
                :key="`sk-${n}-${i}`"
                class="px-4 py-3"
              >
                <div
                  class="h-4 animate-pulse rounded bg-muted"
                  :style="{
                    width: skeletonWidths[(i - 1) % skeletonWidths.length],
                  }"
                />
              </td>
            </tr>
          </tbody>
          <tbody v-else class="[&>tr:not(:last-child)]:border-b">
            <tr
              v-for="row in data"
              :key="(row as any).id"
              class="transition-colors hover:bg-muted/30 cursor-pointer"
              @click="emit('row-click', row)"
            >
              <td v-if="showCheckboxes" class="pl-4 pr-2 py-2" @click.stop>
                <Checkbox
                  :model-value="selectedIds.has(String((row as any).id))"
                  @update:model-value="toggleSelect(String((row as any).id))"
                />
              </td>
              <td
                v-for="col in visibleColumnDefs"
                :key="col.key"
                :class="
                  cn(
                    'px-4 py-2.5',
                    col.alignment === 'right'
                      ? 'text-right'
                      : col.alignment === 'center'
                        ? 'text-center'
                        : 'text-left',
                    col.cellClass,
                  )
                "
              >
                <div
                  v-if="col.type === 'action'"
                  class="flex items-center justify-end gap-0.5"
                  @click.stop
                >
                  <RowActions
                    v-if="(row as any)._actions"
                    :actions="rowActions(row)"
                    :row="row as any"
                    :as-dropdown="col.asDropdown"
                    @action="handleRowAction"
                  />
                  <!-- Client-only row actions (e.g. Spectate) injected by the
                       parent page, rendered alongside the server actions. -->
                  <slot name="row-actions" :row="row" />
                </div>
                <!-- Per-column custom cell override: a parent can supply
                     `#cell-<key>` to render a column the generic CellRenderer
                     can't (e.g. the nested teams[] array). -->
                <slot
                  v-else-if="$slots[`cell-${col.key}`]"
                  :name="`cell-${col.key}`"
                  :value="(row as any)[col.key]"
                  :row="row"
                  :column="col"
                />
                <CellRenderer
                  v-else
                  :value="(row as any)[col.key]"
                  :column="col"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <EmptyState
          v-if="!isInitialLoading && isEmpty"
          :config="meta?.emptyState"
        />

        <div
          v-if="isLoading && !isInitialLoading"
          class="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-sm"
        >
          <div
            class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <TablePagination
      v-if="pagination && pagination.total > 0"
      :pagination="pagination"
      :per-page-options="meta?.perPageOptions ?? [15, 30, 50, 100]"
      @page="setPage"
      @per-page="setPerPage"
    />

    <!-- Confirm dialog -->
    <ConfirmDialog
      v-if="confirmAction"
      :action="confirmAction"
      @confirm="handleConfirm"
      @cancel="cancelAction"
    />

    <!-- Export progress -->
    <ExportProgressOverlay v-if="isExporting" :progress="exportProgress" />
  </div>
</template>
