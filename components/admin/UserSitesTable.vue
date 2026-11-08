<script setup lang="ts">
import { computed, ref } from "vue";
import type { AdminSiteSummary } from "~/types";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
const emit = defineEmits<{ delete: [site: AdminSiteSummary]; refresh: [] }>();
const { t } = useI18n();
const { getSiteTypeLabel } = useStableMetadataLabels();
const search = ref("");
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
    <div class="flex items-end justify-between gap-3">
      <div class="w-full max-w-sm space-y-1.5">
        <Label for="admin-site-search">{{
          t("admin.userDetail.searchSites")
        }}</Label>
        <Input
          id="admin-site-search"
          v-model="search"
          type="search"
          :placeholder="t('admin.userDetail.searchSitesPlaceholder')"
        />
      </div>
      <Button variant="outline" :disabled="loading" @click="emit('refresh')">{{
        t("admin.userDetail.refresh")
      }}</Button>
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
    <div v-else-if="filteredSites.length">
      <Table class="block md:table">
        <TableHeader class="hidden md:table-header-group">
          <TableRow class="bg-muted/30">
            <TableHead>{{ t("admin.userDetail.siteColumn") }}</TableHead>
            <TableHead>{{ t("admin.common.server") }}</TableHead>
            <TableHead>{{ t("admin.userDetail.typeColumn") }}</TableHead>
            <TableHead>{{ t("admin.userDetail.tlsColumn") }}</TableHead>
            <TableHead v-if="canDelete" class="text-right">{{
              t("admin.userDetail.actionsColumn")
            }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="block md:table-row-group">
          <TableRow
            v-for="site in filteredSites"
            :key="site.id"
            class="grid grid-cols-2 md:table-row"
          >
            <TableCell
              class="col-span-2 block break-all pb-2 font-medium md:table-cell md:max-w-sm md:py-4"
            >
              {{ site.address }}
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
              class="col-span-2 block break-words pt-0 pb-2 md:table-cell md:max-w-xs md:py-4"
            >
              <span class="mr-2 text-xs text-muted-foreground md:hidden">{{
                t("admin.common.server")
              }}</span>
              <NuxtLink
                :to="`/admin/servers/${site.server_id}`"
                class="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >{{ site.server_name }}</NuxtLink
              >
            </TableCell>
            <TableCell class="block py-2 md:table-cell md:py-4"
              ><Badge variant="secondary">{{
                getSiteTypeLabel(site.type, site.type)
              }}</Badge></TableCell
            >
            <TableCell
              class="block py-2 text-right text-muted-foreground md:table-cell md:py-4 md:text-left"
              ><span class="mr-2 text-xs md:hidden">{{
                t("admin.userDetail.tlsColumn")
              }}</span
              >{{ tlsLabel(site.tls_setting) }}</TableCell
            >
            <TableCell
              v-if="canDelete"
              class="col-span-2 block pt-1 text-right md:table-cell md:py-4"
            >
              <Badge v-if="isPending(site)" variant="secondary">{{
                t("admin.userDetail.siteDeletionRequested")
              }}</Badge>
              <Button
                v-else
                variant="ghost"
                size="sm"
                class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                :disabled="disabled || !!busyId || loading"
                :aria-label="
                  t('admin.userDetail.deleteSiteNamed', {
                    address: site.address,
                  })
                "
                @click="emit('delete', site)"
              >
                <Icon
                  v-if="busyId === site.id"
                  name="lucide:loader-2"
                  class="h-4 w-4 animate-spin"
                />
                {{ t("admin.userDetail.deleteSite") }}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <p
      v-else
      class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground"
    >
      {{
        search.trim()
          ? t("admin.userDetail.noMatchingSites")
          : t("admin.userDetail.noSites")
      }}
    </p>
  </div>
</template>
