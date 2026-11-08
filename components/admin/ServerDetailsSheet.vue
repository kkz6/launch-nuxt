<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AdminServerDetail } from "~/types";
import ServerDetail from "~/components/admin/ServerDetail.vue";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

const props = defineProps<{ serverId: string | null }>();
const emit = defineEmits<{ "update:serverId": [value: string | null] }>();
const { t } = useI18n();
const serverName = ref("");
const isOpen = computed({
  get: () => !!props.serverId,
  set: (open: boolean) => {
    if (!open) emit("update:serverId", null);
  },
});
watch(
  () => props.serverId,
  () => {
    serverName.value = "";
  },
);
function onLoaded(server: AdminServerDetail): void {
  if (server.id === props.serverId) serverName.value = server.name;
}
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent
      :close-label="t('common.ui.close')"
      class="!inset-y-0 !right-0 flex !h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
    >
      <SheetHeader class="sr-only">
        <SheetTitle>{{ serverName || t("admin.common.server") }}</SheetTitle>
        <SheetDescription>{{
          t("adminResources.serverDetail.description")
        }}</SheetDescription>
      </SheetHeader>
      <div class="min-h-0 flex-1 overflow-y-auto p-5 pt-10 sm:p-6 sm:pt-10">
        <ServerDetail
          v-if="serverId"
          :key="serverId"
          :server-id="serverId"
          @loaded="onLoaded"
          @deleted="emit('update:serverId', null)"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>
