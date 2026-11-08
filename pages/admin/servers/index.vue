<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import { formatDistanceToNow } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import { toast } from "vue-sonner";
import { ListboxFilter } from "reka-ui";
import { useAdminLiveUpdates } from "~/composables/useAdminLiveUpdates";
import { useTable } from "~/composables/useTable";
import { getProviderIcon } from "~/composables/useServerTypeRules";
import TablePagination from "~/components/data-table/TablePagination.vue";
import EmptyState from "~/components/data-table/EmptyState.vue";
import ServerDetailsSheet from "~/components/admin/ServerDetailsSheet.vue";
import { Button } from "~/components/ui/button";
import {
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { DialogDescription, DialogTitle } from "~/components/ui/dialog";

interface ServerRow {
  id: string;
  name: string;
  provider: string;
  public_ipv4?: string | null;
  status: string | { value: string; variant?: string };
  created_at?: string | null;
}

definePageMeta({ layout: "default", middleware: ["auth", "staff"] });

const { locale, t, te } = useI18n();
const selectedServerId = ref<string | null>(null);
const searchOpen = useState<boolean>("adminServerSearchOpen", () => false);
onScopeDispose(() => {
  searchOpen.value = false;
});
const {
  data: servers,
  meta,
  pagination,
  isLoading,
  hasLoaded,
  loadError,
  search,
  setSearch,
  setPage,
  setPerPage,
  refresh,
} = useTable<ServerRow>("/admin/servers/table", { syncUrl: true });
const showPagination = computed(() => {
  const page = pagination.value;
  return !!page && page.total > 0 && (page.lastPage > 1 || page.perPage !== 15);
});
const providerLabels = computed<Record<string, string>>(() => ({
  digitalocean: "DigitalOcean",
  hetzner: "Hetzner",
  linode: "Linode",
  vultr: "Vultr",
  aws: "AWS",
  custom_server: t("common.customServer"),
}));
const providerLabel = (provider: string): string =>
  providerLabels.value[provider.toLowerCase()] || provider;
const providerIcon = (provider: string): string => {
  const key = provider.toLowerCase().replace(/\s+/g, "_");
  return key === "custom" || key === "custom_server"
    ? "lucide:server"
    : getProviderIcon(key);
};
const selectServer = (serverId: string): void => {
  searchOpen.value = false;
  selectedServerId.value = serverId;
};
const statusText = (status: ServerRow["status"]): string => {
  if (typeof status === "object") return status.value;
  const key = `admin.statuses.server.${status}`;
  return te(key) ? t(key) : status.replace(/_/g, " ");
};
const statusColor = (status: ServerRow["status"]): string => {
  const variants: Record<string, string> = {
    running: "success",
    new: "info",
    starting: "info",
    provisioning: "info",
    awaiting_connection: "warning",
    paused: "warning",
    failed: "destructive",
    deleting: "destructive",
  };
  const variant =
    typeof status === "object" ? status.variant : variants[status];
  return (
    (
      {
        success: "bg-green-500",
        info: "bg-blue-500",
        warning: "bg-yellow-500",
        destructive: "bg-red-500",
      } as Record<string, string>
    )[variant || ""] || "bg-muted-foreground"
  );
};
const formatDate = (date?: string | null): string => {
  if (!date) return "—";
  try {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: locale.value === "ja" ? ja : enUS,
    });
  } catch {
    return "—";
  }
};

useHead({ title: () => t("admin.serversList.pageTitle") });
const applyBreadcrumb = (): void => {
  setBreadcrumbs([
    { label: t("admin.common.admin"), to: "/admin/overview" },
    { label: t("admin.common.servers") },
  ]);
};
applyBreadcrumb();
watch(locale, applyBreadcrumb);
useAdminLiveUpdates(refresh, {
  resources: ["server", "site", "docker", "user", "team"],
  onChange(change) {
    if (change.resource === "server" && change.action === "deletion_failed") {
      toast.error(t("admin.serverDetail.deleteFailed"));
    }
  },
});
</script>

<template>
  <div class="space-y-4 pb-10">
    <h1 class="sr-only">{{ t("admin.common.servers") }}</h1>
    <div
      v-if="loadError"
      role="alert"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm"
    >
      <div>
        <p>{{ t("data.loadFailed") }}</p>
        <p v-if="servers.length" class="mt-1 text-muted-foreground">
          {{ t("data.staleData") }}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        :disabled="isLoading"
        @click="refresh"
        >{{ t("data.retry") }}</Button
      >
    </div>
    <div
      v-if="!hasLoaded"
      class="flex items-center justify-center py-12"
      role="status"
      :aria-label="t('data.loadingData')"
    >
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
    </div>
    <div
      v-else-if="servers.length"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <button
        v-for="server in servers"
        :key="server.id"
        type="button"
        aria-haspopup="dialog"
        :aria-label="
          t('admin.userDetail.viewServerNamed', { name: server.name })
        "
        :aria-describedby="`server-status-${server.id}`"
        class="group relative flex h-full flex-col rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        @click="selectedServerId = server.id"
      >
        <span class="relative flex items-start gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors duration-200"
          >
            <Icon
              :name="providerIcon(server.provider)"
              class="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span class="truncate font-semibold">{{ server.name }}</span>
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                :class="statusColor(server.status)"
                aria-hidden="true"
              />
            </span>
            <span class="block truncate text-sm text-muted-foreground">{{
              providerLabel(server.provider)
            }}</span>
            <span
              v-if="server.public_ipv4"
              class="block truncate text-sm text-muted-foreground"
              >{{ server.public_ipv4 }}</span
            >
          </span>
        </span>
        <span
          class="relative mt-auto flex min-h-7 items-center justify-between gap-3 pt-4 text-sm text-muted-foreground"
        >
          <span :id="`server-status-${server.id}`">{{
            statusText(server.status)
          }}</span>
          <time v-if="server.created_at" :datetime="server.created_at">{{
            formatDate(server.created_at)
          }}</time>
        </span>
      </button>
    </div>
    <EmptyState
      v-else-if="!loadError"
      :config="
        search.trim() ? { title: t('data.noResults') } : meta?.emptyState
      "
    />
    <TablePagination
      v-if="showPagination && pagination"
      :pagination="pagination"
      :per-page-options="meta?.perPageOptions ?? [15, 30, 50]"
      @page="setPage"
      @per-page="setPerPage"
    />
    <CommandDialog v-model:open="searchOpen">
      <DialogTitle class="sr-only">{{
        t("admin.userDetail.searchServers")
      }}</DialogTitle>
      <DialogDescription class="sr-only"
        >{{ t("adminResources.servers.allTeams") }}.
        {{ t("adminResources.servers.searchHint") }}</DialogDescription
      >
      <div class="flex items-center border-b px-3 pr-12" cmdk-input-wrapper>
        <Icon
          name="lucide:search"
          class="mr-2 h-4 w-4 shrink-0 opacity-50"
          aria-hidden="true"
        />
        <ListboxFilter
          :model-value="search"
          :placeholder="
            meta?.search.placeholder || t('admin.userDetail.searchServers')
          "
          :aria-label="t('admin.userDetail.searchServers')"
          auto-focus
          class="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          @update:model-value="setSearch"
        />
      </div>
      <CommandList
        :aria-label="t('adminResources.servers.directory')"
        class="p-2"
      >
        <div
          v-if="loadError"
          role="alert"
          class="flex items-center justify-between gap-3 p-3 text-sm"
        >
          <p>{{ t("data.loadFailed") }}</p>
          <Button
            variant="outline"
            size="sm"
            :disabled="isLoading"
            @click="refresh"
            @keydown.enter.stop
            >{{ t("data.retry") }}</Button
          >
        </div>
        <div
          v-if="isLoading || !hasLoaded"
          role="status"
          class="flex justify-center p-4"
          :aria-label="t('data.loadingData')"
        >
          <Icon
            name="lucide:loader-2"
            class="h-5 w-5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <CommandGroup v-else :heading="t('adminResources.servers.allTeams')">
          <CommandItem
            v-for="server in servers"
            :key="`${search}:${server.id}`"
            :value="server.id"
            @select="selectServer(server.id)"
          >
            <Icon
              :name="providerIcon(server.provider)"
              class="text-muted-foreground"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ server.name }}</span>
              <span class="block truncate text-xs text-muted-foreground"
                >{{ providerLabel(server.provider)
                }}<template v-if="server.public_ipv4">
                  · {{ server.public_ipv4 }}</template
                ></span
              >
            </span>
            <span class="shrink-0 text-xs text-muted-foreground">{{
              statusText(server.status)
            }}</span>
          </CommandItem>
          <p
            v-if="!servers.length && !loadError"
            class="p-4 text-center text-sm text-muted-foreground"
          >
            {{ t("data.noResults") }}
          </p>
        </CommandGroup>
      </CommandList>
      <div
        v-if="pagination && pagination.lastPage > 1"
        class="border-t px-3 pb-2"
      >
        <TablePagination
          :pagination="pagination"
          :per-page-options="meta?.perPageOptions ?? [15, 30, 50]"
          @page="setPage"
          @per-page="setPerPage"
        />
      </div>
    </CommandDialog>
    <ServerDetailsSheet v-model:server-id="selectedServerId" />
  </div>
</template>
