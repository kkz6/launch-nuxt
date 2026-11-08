<script setup lang="ts">
import { computed, ref } from "vue";
import type { AdminSiteSummary } from "~/types";
import SiteDetailsSheet from "~/components/admin/SiteDetailsSheet.vue";
import ServerDetailsSheet from "~/components/admin/ServerDetailsSheet.vue";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

const props = defineProps<{
  sites: AdminSiteSummary[];
  loading: boolean;
  canDelete: boolean;
  disabled?: boolean;
  busyId: string | null;
  pendingIds: string[];
  errors: Record<string, string>;
}>();
const emit = defineEmits<{ delete: [site: AdminSiteSummary] }>();
const { t } = useI18n();
const { getSiteTypeLabel } = useStableMetadataLabels();
const search = ref("");
const selectedSiteId = ref<string | null>(null);
const siteDetailOpen = ref(false);
const selectedServerId = ref<string | null>(null);
const selectedSite = computed(
  () => props.sites.find((site) => site.id === selectedSiteId.value) ?? null,
);
const openSite = (site: AdminSiteSummary) => {
  selectedSiteId.value = site.id;
  siteDetailOpen.value = true;
};
const openServer = (serverId: string) => {
  siteDetailOpen.value = false;
  selectedServerId.value = serverId;
};
const filteredSites = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return props.sites.filter((site) =>
    `${site.address} ${site.server_name}`.toLocaleLowerCase().includes(query),
  );
});
const isPending = (site: AdminSiteSummary): boolean =>
  props.pendingIds.includes(site.id) ||
  (!!site.uninstallation_requested_at && !site.uninstallation_failed_at);
const tlsLabel = (value: string): string =>
  ["auto", "custom", "internal", "off"].includes(value)
    ? t(`admin.userDetail.tls.${value}`)
    : value;
</script>

<template>
  <div class="space-y-4">
    <div class="relative w-full sm:w-72">
      <Label for="admin-site-search" class="sr-only">{{
        t("admin.userDetail.searchSites")
      }}</Label>
      <Icon
        name="lucide:search"
        class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id="admin-site-search"
        v-model="search"
        type="search"
        class="h-9 border-border/70 bg-background pl-9 shadow-none"
        :placeholder="t('admin.userDetail.searchSitesPlaceholder')"
      />
    </div>
    <p
      v-if="pendingIds.length || sites.some(isPending)"
      role="status"
      class="text-sm text-muted-foreground"
    >
      {{ t("admin.userDetail.siteDeletionPendingHelp") }}
    </p>
    <div
      v-if="loading && !sites.length"
      class="flex items-center justify-center py-12"
    >
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>
    <div v-else-if="filteredSites.length" class="[&>div]:overflow-x-auto">
      <Table class="block md:table">
        <TableHeader class="hidden md:table-header-group">
          <TableRow
            class="bg-muted/40 hover:bg-muted/40 [&>th]:h-10 [&>th]:text-xs"
          >
            <TableHead>{{ t("admin.userDetail.siteColumn") }}</TableHead>
            <TableHead>{{ t("admin.common.server") }}</TableHead>
            <TableHead>{{ t("admin.userDetail.typeColumn") }}</TableHead>
            <TableHead>{{ t("admin.userDetail.tlsColumn") }}</TableHead>
            <TableHead class="w-24 text-right">
              <span class="sr-only">{{
                t("admin.userDetail.actionsColumn")
              }}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="block md:table-row-group">
          <TableRow
            v-for="site in filteredSites"
            :key="site.id"
            class="grid grid-cols-2 px-3 py-2 transition-colors duration-150 last:border-b-0 hover:bg-muted/20 md:table-row md:p-0"
          >
            <TableCell
              class="col-span-2 block break-all px-0 pb-2 font-medium md:table-cell md:max-w-sm md:px-4 md:py-2"
            >
              <span class="flex items-start gap-2.5">
                <Icon
                  name="lucide:globe-2"
                  class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  class="min-w-0 rounded-sm text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  @click="openSite(site)"
                >
                  {{ site.address }}
                </button>
              </span>
              <Badge v-if="isPending(site)" variant="secondary" class="mt-1">{{
                t("admin.userDetail.siteDeletionRequested")
              }}</Badge>
              <p
                v-if="errors[site.id]"
                role="alert"
                class="mt-1 text-xs font-normal text-destructive"
              >
                {{ errors[site.id] }}
              </p>
              <p
                v-else-if="site.uninstallation_failed_at"
                role="alert"
                class="mt-1 text-xs font-normal text-destructive"
              >
                {{ t("admin.userDetail.siteDeletionFailed") }}
              </p>
            </TableCell>
            <TableCell
              class="col-span-2 block break-words px-0 pt-0 pb-2 text-xs md:table-cell md:max-w-xs md:px-4 md:py-2"
            >
              <span class="mr-2 text-xs text-muted-foreground md:hidden">{{
                t("admin.common.server")
              }}</span>
              <button
                type="button"
                class="rounded-sm text-left text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :aria-label="
                  t('admin.userDetail.viewServerNamed', {
                    name: site.server_name,
                  })
                "
                @click="openServer(site.server_id)"
              >
                {{ site.server_name }}
              </button>
            </TableCell>
            <TableCell
              class="block px-0 py-2 text-xs text-muted-foreground md:table-cell md:px-4 md:py-2"
            >
              {{ getSiteTypeLabel(site.type, site.type) }}
            </TableCell>
            <TableCell
              class="block px-0 py-2 text-right text-xs text-muted-foreground md:table-cell md:px-4 md:py-2 md:text-left"
              ><span class="mr-2 text-xs md:hidden">{{
                t("admin.userDetail.tlsColumn")
              }}</span
              >{{ tlsLabel(site.tls_setting) }}</TableCell
            >
            <TableCell
              class="col-span-2 block px-0 pt-1 text-right md:table-cell md:w-24 md:px-4 md:py-2"
            >
              <div class="flex items-center justify-end gap-1">
                <TooltipProvider :delay-duration="200">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-muted-foreground"
                        :aria-label="
                          t('admin.userDetail.viewSiteNamed', {
                            address: site.address,
                          })
                        "
                        :title="
                          t('admin.userDetail.viewSiteNamed', {
                            address: site.address,
                          })
                        "
                        @click="openSite(site)"
                      >
                        <Icon
                          name="lucide:panel-right-open"
                          class="h-4 w-4"
                          aria-hidden="true"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{{
                      t("admin.userDetail.viewSiteNamed", {
                        address: site.address,
                      })
                    }}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider
                  v-if="canDelete && !isPending(site)"
                  :delay-duration="200"
                >
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        :disabled="disabled || !!busyId || loading"
                        :aria-label="
                          t('admin.userDetail.deleteSiteNamed', {
                            address: site.address,
                          })
                        "
                        :title="
                          t('admin.userDetail.deleteSiteNamed', {
                            address: site.address,
                          })
                        "
                        @click="emit('delete', site)"
                      >
                        <Icon
                          :name="
                            busyId === site.id
                              ? 'lucide:loader-2'
                              : 'lucide:trash-2'
                          "
                          class="h-4 w-4"
                          :class="{ 'animate-spin': busyId === site.id }"
                          aria-hidden="true"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {{
                        t("admin.userDetail.deleteSiteNamed", {
                          address: site.address,
                        })
                      }}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <p v-else class="py-16 text-center text-sm text-muted-foreground">
      {{
        search.trim()
          ? t("admin.userDetail.noMatchingSites")
          : t("admin.userDetail.noSites")
      }}
    </p>
    <SiteDetailsSheet
      v-model:open="siteDetailOpen"
      :site="selectedSite"
      :pending="selectedSite ? isPending(selectedSite) : false"
      :error="selectedSiteId ? errors[selectedSiteId] : undefined"
      @view-server="openServer"
    />
    <ServerDetailsSheet v-model:server-id="selectedServerId" />
  </div>
</template>
