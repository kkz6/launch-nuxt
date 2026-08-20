<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useDaemonEvents } from "~/composables/useChannelEvents";
import type { QueueDaemon, Server } from "~/types";

interface Props {
  server: Server;
}

const props = defineProps<Props>();
const { t } = useI18n();
const serverId = computed(() => props.server.id);

const daemons = ref<QueueDaemon[]>([]);
const isLoading = ref(true);
const restartingId = ref<string | null>(null);
const isSyncing = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// Log viewer state
const selectedDaemonForLogs = ref<QueueDaemon | null>(null);
const isLogDialogOpen = ref(false);

// Edit dialog state
const selectedDaemonForEdit = ref<QueueDaemon | null>(null);
const isEditDialogOpen = ref(false);

const viewLogs = (daemon: QueueDaemon) => {
  selectedDaemonForLogs.value = daemon;
  isLogDialogOpen.value = true;
};

const editDaemon = (daemon: QueueDaemon) => {
  selectedDaemonForEdit.value = daemon;
  isEditDialogOpen.value = true;
};

const fetchData = async () => {
  try {
    const data = await $api<{ data: QueueDaemon[] }>(
      `/servers/${serverId.value}/daemons`,
    );
    daemons.value = data.data;
  } catch {
    toast.error(t("server.daemons.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const deleteDaemon = async (daemon: QueueDaemon) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.daemons.deleteTitle"),
    description: t("server.daemons.deleteDescription"),
    confirmText: t("server.common.delete"),
    cancelText: t("server.common.cancel"),
    destructive: true,
    helpText: t("server.daemons.deleteHelp"),
    inputVerificationText: daemon.command,
  });

  if (result.ok) {
    try {
      await $api(`/servers/${serverId.value}/daemons/${daemon.id}`, {
        method: "DELETE",
      });
      daemons.value = daemons.value.filter((d) => d.id !== daemon.id);
      toast.success(t("server.daemons.deleteSuccess"));
    } catch {
      toast.error(t("server.daemons.deleteFailed"));
    }
  } else {
    toast.info(t("server.common.cancelled"));
  }
};

const restartDaemon = async (daemon: QueueDaemon) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.daemons.restartTitle"),
    description: t("server.daemons.restartDescription"),
    confirmText: t("server.daemons.restart"),
    cancelText: t("server.common.cancel"),
  });

  if (result.ok) {
    restartingId.value = daemon.id;
    try {
      await $api(`/servers/${serverId.value}/daemons/${daemon.id}/restart`, {
        method: "POST",
      });
      toast.success(t("server.daemons.restartStarted"));
    } catch {
      toast.error(t("server.daemons.restartFailed"));
      restartingId.value = null;
    }
  }
};

const syncStatus = async () => {
  isSyncing.value = true;
  try {
    await $api(`/servers/${serverId.value}/daemons/sync`, {
      method: "POST",
    });
    toast.success(t("server.daemons.syncStarted"));
  } catch {
    toast.error(t("server.daemons.syncFailed"));
    isSyncing.value = false;
  }
};

const handleDaemonUpdated = () => {
  isEditDialogOpen.value = false;
  selectedDaemonForEdit.value = null;
  fetchData();
};

// Clean up selected daemon when dialog closes
watch(isEditDialogOpen, (open) => {
  if (!open) {
    selectedDaemonForEdit.value = null;
  }
});

const hasStatusInfo = computed(() =>
  daemons.value.some((d) => d.last_status_check !== null),
);

// Get current team for WebSocket channel
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");

// Debounced refetch for WebSocket events
let daemonFetchTimeout: ReturnType<typeof setTimeout> | null = null;

useDaemonEvents(teamId, (data) => {
  if (data.server_id === serverId.value) {
    if (daemonFetchTimeout) clearTimeout(daemonFetchTimeout);
    daemonFetchTimeout = setTimeout(() => {
      fetchData();
      restartingId.value = null;
      isSyncing.value = false;
    }, 300);
  }
});

onMounted(fetchData);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Log Viewer Dialog -->
    <SharedLogViewerDialog
      v-if="selectedDaemonForLogs"
      v-model:open="isLogDialogOpen"
      :server-id="server.id"
      entity="daemon"
      :entity-id="selectedDaemonForLogs.id"
      :title="t('server.daemons.logs')"
      :description="selectedDaemonForLogs.command"
    />

    <!-- Edit Daemon Dialog -->
    <ServerCreateDaemon
      v-if="selectedDaemonForEdit"
      v-model:open="isEditDialogOpen"
      :server="server"
      :daemon="selectedDaemonForEdit"
      @updated="handleDaemonUpdated"
    />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">{{ t("server.daemons.title") }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ t("server.daemons.description") }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          v-if="daemons.length > 0"
          variant="outline"
          size="sm"
          :disabled="isSyncing"
          @click="syncStatus"
        >
          <Icon
            name="lucide:refresh-cw"
            :class="['mr-2 h-4 w-4', isSyncing && 'animate-spin']"
          />
          {{
            isSyncing
              ? t("server.daemons.syncing")
              : t("server.daemons.syncStatus")
          }}
        </Button>
        <ServerCreateDaemon
          v-if="daemons.length > 0"
          :server="server"
          @created="fetchData"
        />
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <SharedDataTable
        :data="daemons"
        :columns="[
          { key: 'command', label: t('server.daemons.command'), width: '30%' },
          { key: 'user', label: t('server.daemons.user'), width: '15%' },
          {
            key: 'processes',
            label: t('server.daemons.processes'),
            width: '10%',
          },
          ...(hasStatusInfo
            ? [
                {
                  key: 'running',
                  label: t('server.daemons.status'),
                  width: '15%',
                },
              ]
            : []),
          {
            key: 'installed_at',
            label: t('server.daemons.installed'),
            width: '15%',
            type: 'relative-date' as const,
          },
        ]"
        :empty-title="t('server.daemons.empty')"
        empty-icon="lucide:activity"
      >
        <template #actions="{ item }">
          <Button
            variant="ghost"
            size="icon"
            :title="t('server.daemons.viewLogs')"
            @click="viewLogs(item)"
          >
            <Icon name="lucide:scroll-text" class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :title="t('server.daemons.restart')"
            :disabled="restartingId === item.id"
            @click="restartDaemon(item)"
          >
            <Icon
              v-if="restartingId === item.id"
              name="lucide:loader-2"
              class="h-4 w-4 animate-spin"
            />
            <Icon v-else name="lucide:rotate-ccw" class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :title="t('server.common.edit')"
            @click="editDaemon(item)"
          >
            <Icon name="lucide:pencil" class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :title="t('server.common.delete')"
            class="hover:bg-destructive/90 hover:text-white"
            @click="deleteDaemon(item)"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4" />
          </Button>
        </template>

        <template #empty>
          <ServerCreateDaemon :server="server" @created="fetchData" />
        </template>

        <template #cell-running="{ value, row }">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Badge
                  :variant="value ? 'success' : 'secondary'"
                  class="cursor-help"
                >
                  {{
                    value
                      ? t("server.daemons.running")
                      : t("server.daemons.stopped")
                  }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent class="max-w-xs">
                <div class="space-y-1.5 text-sm">
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span class="text-muted-foreground"
                      >{{ t("server.daemons.status") }}:</span
                    >
                    <span :class="value ? 'text-green-500' : 'text-red-500'">
                      {{
                        row.info?.state ||
                        (value
                          ? t("server.daemons.running")
                          : t("server.daemons.stopped"))
                      }}
                    </span>
                    <template v-if="row.info?.uptime">
                      <span class="text-muted-foreground">{{
                        t("server.daemons.uptime")
                      }}</span>
                      <span>{{ row.info.uptime }}</span>
                    </template>
                    <template v-if="row.info?.pid">
                      <span class="text-muted-foreground">{{
                        t("server.daemons.pid")
                      }}</span>
                      <span>{{ row.info.pid }}</span>
                    </template>
                    <span class="text-muted-foreground"
                      >{{ t("server.daemons.processes") }}:</span
                    >
                    <span>{{ row.processes || 1 }}</span>
                    <span class="text-muted-foreground"
                      >{{ t("server.daemons.user") }}:</span
                    >
                    <span>{{ row.user }}</span>
                    <template v-if="row.directory">
                      <span class="text-muted-foreground">{{
                        t("server.daemons.directory")
                      }}</span>
                      <span class="truncate">{{ row.directory }}</span>
                    </template>
                  </div>
                  <p
                    v-if="row.last_status_check"
                    class="border-t pt-1.5 text-xs text-muted-foreground"
                  >
                    {{ t("server.daemons.lastChecked") }}
                    <SharedDateTooltip :date="row.last_status_check" />
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </template>
      </SharedDataTable>
    </template>
  </div>
</template>
