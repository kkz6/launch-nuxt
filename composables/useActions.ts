// Row + bulk action state for the DataTable. Tracks per-row selection,
// stages confirm-required actions until the dialog resolves, and dispatches
// the network call through our useApi() so the bearer token + 401 retry
// behaviour is consistent with the rest of the app.

import { ref, computed } from "vue";
import type { ActionDef } from "~/types/data-table";

export function useActions(actionEndpoint: string | (() => string)) {
  const selectedIds = ref<Set<string>>(new Set());
  const confirmAction = ref<ActionDef | null>(null);
  const pendingAction = ref<{ action: ActionDef; payload: any } | null>(null);

  const hasSelection = computed(() => selectedIds.value.size > 0);
  const selectedCount = computed(() => selectedIds.value.size);

  function endpoint(): string {
    return typeof actionEndpoint === "function"
      ? actionEndpoint()
      : actionEndpoint;
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.value = next;
  }

  function toggleSelectAll(ids: string[]) {
    if (selectedIds.value.size === ids.length) {
      selectedIds.value = new Set();
    } else {
      selectedIds.value = new Set(ids);
    }
  }

  function clearSelection() {
    selectedIds.value = new Set();
  }

  async function executeAction(
    _tableClass: string,
    action: ActionDef,
    payload?: { id?: string; ids?: string[] },
  ) {
    if (action.confirm) {
      confirmAction.value = action;
      pendingAction.value = { action, payload };
      return;
    }
    return performAction(action, payload);
  }

  async function executeConfirmedAction(_tableClass: string) {
    if (!pendingAction.value) return;
    const { action, payload } = pendingAction.value;
    confirmAction.value = null;
    pendingAction.value = null;
    return performAction(action, payload);
  }

  function cancelAction() {
    confirmAction.value = null;
    pendingAction.value = null;
  }

  async function performAction(
    action: ActionDef,
    payload?: { id?: string; ids?: string[] },
  ) {
    if (action.type === "link" && action.url) {
      // Use the SPA router when the URL is in-app; fall back to window for
      // external links.
      if (action.url.startsWith("/")) {
        await navigateTo(action.url);
      } else {
        window.location.href = action.url;
      }
      return;
    }
    const ids = payload?.ids ?? (payload?.id ? [payload.id] : []);
    if (ids.length === 0) return;
    const api = useApi();
    return api.post(`${endpoint()}/${action.name}`, { ids });
  }

  return {
    selectedIds,
    hasSelection,
    selectedCount,
    confirmAction,
    pendingAction,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    executeAction,
    executeConfirmedAction,
    cancelAction,
  };
}
