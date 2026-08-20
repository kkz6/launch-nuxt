<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useCommandEvents } from "~/composables/useChannelEvents";
import { reconcileCommandUpdate, type SiteCommand } from "~/utils/siteCommands";

interface Props {
  serverId: string;
  siteId: string;
}

const props = defineProps<Props>();
const { t } = useI18n();
const { user } = useAuth();

const commands = ref<SiteCommand[]>([]);
const isLoading = ref(true);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);
const teamId = computed(() => String(user.value?.current_team_id || ""));
let commandStateVersion = 0;

const statusVariants: Record<
  string,
  "default" | "secondary" | "success" | "destructive" | "warning"
> = {
  pending: "warning",
  running: "default",
  finished: "success",
  failed: "destructive",
};

const statusLabels = computed<Record<string, string>>(() => ({
  pending: t("site.status.pending"),
  running: t("site.status.running"),
  finished: t("site.status.finished"),
  completed: t("site.status.completed"),
  failed: t("site.status.failed"),
}));

const fetchCommands = async () => {
  const requestedAtVersion = commandStateVersion;
  try {
    const data = await $api<{ data: SiteCommand[] }>(
      `/servers/${props.serverId}/sites/${props.siteId}/commands`,
    );
    if (requestedAtVersion === commandStateVersion) {
      commands.value = data.data;
    }
  } catch {
    toast.error(t("site.commands.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

useCommandEvents(teamId, (data) => {
  const nextCommands = reconcileCommandUpdate(
    commands.value,
    data,
    props.siteId,
  );
  if (nextCommands !== commands.value) {
    commandStateVersion++;
    commands.value = nextCommands;
  }
});

const deleteCommand = async (command: SiteCommand) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("site.commands.deleteTitle"),
    description: t("site.commands.deleteDescription"),
    confirmText: t("site.common.delete"),
    cancelText: t("site.common.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(
        `/servers/${props.serverId}/sites/${props.siteId}/commands/${command.id}`,
        {
          method: "DELETE",
        },
      );
      commandStateVersion++;
      commands.value = commands.value.filter((c) => c.id !== command.id);
      toast.success(t("site.commands.deleted"));
    } catch {
      toast.error(t("site.commands.deleteFailed"));
    }
  }
};

const runCommandAgain = async (command: SiteCommand) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("site.commands.runAgainTitle"),
    description: t("site.commands.runAgainDescription", {
      command: command.command,
    }),
    confirmText: t("site.runCommand.run"),
    cancelText: t("site.common.cancel"),
  });

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/sites/${props.siteId}/commands`, {
        method: "POST",
        body: { command: command.command },
      });
      toast.success(t("site.runCommand.started"));
      fetchCommands();
    } catch {
      toast.error(t("site.runCommand.failed"));
    }
  }
};

onMounted(fetchCommands);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">{{ t("site.commands.title") }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ t("site.commands.description") }}
        </p>
      </div>
      <SiteRunCommand
        v-if="commands.length > 0"
        :server-id="serverId"
        :site-id="siteId"
        @executed="fetchCommands"
      />
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <SharedDataTable
        :data="commands"
        :columns="[
          { key: 'user', label: t('site.commands.user'), width: '15%' },
          { key: 'command', label: t('site.commands.command'), width: '35%' },
          { key: 'created_at', label: t('site.common.created'), width: '20%' },
          { key: 'status', label: t('site.common.status'), width: '15%' },
        ]"
        :empty-title="t('site.commands.empty')"
        empty-icon="lucide:terminal"
      >
        <template #cell-user="{ row }">
          {{ row.user?.name || t("site.common.unknown") }}
        </template>

        <template #cell-command="{ row }">
          <code class="rounded bg-muted px-2 py-1 text-sm">{{
            row.command
          }}</code>
        </template>

        <template #cell-created_at="{ row }">
          <SharedDateTooltip :date="row.created_at" />
        </template>

        <template #cell-status="{ row }">
          <Badge
            :variant="statusVariants[row.status] || 'secondary'"
            class="gap-1.5"
          >
            <Icon
              v-if="row.status === 'running'"
              name="lucide:loader-2"
              class="h-3 w-3 animate-spin"
            />
            <span>{{ statusLabels[row.status] || row.status }}</span>
          </Badge>
        </template>

        <template #actions="{ item }">
          <SharedOutputViewer
            v-if="item.output"
            :title="t('site.commands.output')"
            :description="item.command"
            :output="item.output"
          >
            <Button
              variant="ghost"
              size="icon"
              :title="t('site.commands.viewOutput')"
            >
              <Icon name="lucide:terminal-square" class="h-4 w-4" />
            </Button>
          </SharedOutputViewer>
          <Button
            variant="ghost"
            size="icon"
            :title="t('site.commands.runAgain')"
            @click="runCommandAgain(item)"
          >
            <Icon name="lucide:rotate-ccw" class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :title="t('site.common.delete')"
            class="hover:bg-destructive/90 hover:text-white"
            @click="deleteCommand(item)"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4" />
          </Button>
        </template>

        <template #empty>
          <SiteRunCommand
            :server-id="serverId"
            :site-id="siteId"
            @executed="fetchCommands"
          />
        </template>
      </SharedDataTable>
    </template>
  </div>
</template>
