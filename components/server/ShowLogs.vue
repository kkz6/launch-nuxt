<script setup lang="ts">
import { toast } from "vue-sonner";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { LogInfo } from "~/types";
import { useStableMetadataLabels } from "~/composables/useStableMetadataLabels";

interface Props {
  serverId: string;
  type?: "server" | "site";
  siteId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: "server",
});
const { t } = useI18n();
const { getLogName } = useStableMetadataLabels();

const logs = ref<LogInfo[]>([]);
const selectedLogIndex = ref<string>("");
const isLoading = ref(true);

const fetchLogs = async () => {
  try {
    const endpoint =
      props.type === "site"
        ? `/servers/${props.serverId}/sites/${props.siteId}/logs`
        : `/servers/${props.serverId}/logs`;
    const data = await $api<{ data: LogInfo[] }>(endpoint);
    logs.value = data.data;
  } catch {
    toast.error(t("server.logs.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const selectedLog = computed(() => {
  if (!selectedLogIndex.value) return null;
  return logs.value[parseInt(selectedLogIndex.value)];
});

onMounted(fetchLogs);
</script>

<template>
  <div>
    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">{{ t("server.logs.title") }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ t("server.logs.description") }}
        </p>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <div class="space-y-4">
        <div class="space-y-2">
          <Label>{{ t("server.logs.selectService") }}</Label>
          <Select v-model="selectedLogIndex">
            <SelectTrigger class="w-full max-w-sm">
              <SelectValue
                :placeholder="t('server.logs.selectServicePlaceholder')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="(log, index) in logs"
                :key="index"
                :value="String(index)"
              >
                {{ getLogName(log) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ServerLogViewer
          v-if="selectedLog"
          :key="`${selectedLogIndex}-${selectedLog.software}`"
          :server-id="serverId"
          :entity="type"
          :entity-id="type === 'site' ? siteId || '' : serverId"
          :software="selectedLog.software"
          :route="selectedLog.show_route"
          no-timestamp
          hide-options
        />
      </div>
    </template>
  </div>
</template>
