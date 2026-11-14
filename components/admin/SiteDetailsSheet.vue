<script setup lang="ts">
import { computed } from "vue";
import type { AdminSiteSummary } from "~/types";
import { Badge } from "~/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

const props = defineProps<{
  open: boolean;
  site: AdminSiteSummary | null;
  pending?: boolean;
}>();
const emit = defineEmits<{
  "update:open": [open: boolean];
  viewServer: [serverId: string];
}>();
const { t } = useI18n();
const { getSiteTypeLabel } = useStableMetadataLabels();
const isOpen = computed({
  get: () => props.open,
  set: (open: boolean) => emit("update:open", open),
});
const deletionPending = computed(
  () =>
    !props.site?.uninstallation_failed_at &&
    (props.pending || !!props.site?.uninstallation_requested_at),
);
const tlsLabel = computed(() => {
  const value = props.site?.tls_setting || "";
  return ["auto", "custom", "internal", "off"].includes(value)
    ? t(`admin.userDetail.tls.${value}`)
    : value;
});
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent
      :close-label="t('common.ui.close')"
      class="!inset-y-0 !right-0 !h-full w-full overflow-y-auto sm:max-w-md"
    >
      <SheetHeader class="pr-6 text-left">
        <SheetTitle>{{ t("admin.siteDetail.title") }}</SheetTitle>
        <SheetDescription class="break-all">{{
          site?.address || t("admin.siteDetail.unavailable")
        }}</SheetDescription>
      </SheetHeader>
      <template v-if="site">
        <dl class="mt-6 divide-y text-sm">
          <div class="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 py-3">
            <dt class="text-muted-foreground">
              {{ t("admin.common.server") }}
            </dt>
            <dd class="min-w-0">
              <button
                type="button"
                class="rounded-sm text-left font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :aria-label="
                  t('admin.userDetail.viewServerNamed', {
                    name: site.server_name,
                  })
                "
                @click="emit('viewServer', site.server_id)"
              >
                {{ site.server_name }}
              </button>
            </dd>
          </div>
          <div class="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 py-3">
            <dt class="text-muted-foreground">
              {{ t("admin.userDetail.typeColumn") }}
            </dt>
            <dd>{{ getSiteTypeLabel(site.type, site.type) }}</dd>
          </div>
          <div class="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 py-3">
            <dt class="text-muted-foreground">
              {{ t("admin.userDetail.tlsColumn") }}
            </dt>
            <dd>{{ tlsLabel }}</dd>
          </div>
          <div
            v-if="site.repository_branch"
            class="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 py-3"
          >
            <dt class="text-muted-foreground">
              {{ t("admin.siteDetail.branch") }}
            </dt>
            <dd class="break-all font-mono text-xs">
              {{ site.repository_branch }}
            </dd>
          </div>
          <div
            v-if="site.created_at"
            class="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 py-3"
          >
            <dt class="text-muted-foreground">
              {{ t("admin.serverDetail.created") }}
            </dt>
            <dd><SharedDateTooltip :date="site.created_at" /></dd>
          </div>
          <div class="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 py-3">
            <dt class="text-muted-foreground">
              {{ t("admin.siteDetail.deletion") }}
            </dt>
            <dd>
              <Badge v-if="site.uninstallation_failed_at" variant="red">{{
                t("admin.siteDetail.deletionFailed")
              }}</Badge>
              <Badge v-else-if="deletionPending" variant="orange">{{
                t("admin.userDetail.siteDeletionRequested")
              }}</Badge>
              <span v-else>{{ t("admin.siteDetail.notRequested") }}</span>
            </dd>
          </div>
        </dl>
        <p
          v-if="deletionPending"
          role="status"
          class="mt-4 text-sm text-muted-foreground"
        >
          {{ t("admin.userDetail.siteDeletionPendingHelp") }}
        </p>
      </template>
    </SheetContent>
  </Sheet>
</template>
