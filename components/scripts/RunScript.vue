<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface Script {
  id: string;
  name: string;
  run_as: "root" | "local";
  content: string;
}

interface Server {
  id: string;
  name: string;
  public_ipv4: string;
  provider: string;
  connected: boolean;
}

interface Props {
  script: Script;
}

const props = defineProps<Props>();
const { t, locale } = useI18n();

const emit = defineEmits<{
  ran: [];
}>();

const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);
const isLoadingServers = ref(true);
const servers = ref<Server[]>([]);
const selectedServers = ref<string[]>([]);
const runAs = ref<"root" | "local">("root");

// Execution monitor state
const showMonitor = ref(false);
const executionBatchId = ref("");
const executionServerIds = ref<string[]>([]);

const providerLabels: Record<string, string> = {
  digitalocean: "DigitalOcean",
  hetzner: "Hetzner",
  linode: "Linode",
  vultr: "Vultr",
  aws: "AWS",
};

const localeTag = computed(() => (locale.value === "ja" ? "ja-JP" : "en-US"));
const numberFormatter = computed(() => new Intl.NumberFormat(localeTag.value));

const getProviderLabel = (provider: string) => {
  if (provider === "custom_server")
    return t("operations.scripts.run.customProvider");
  return providerLabels[provider] || provider;
};

const fetchServers = async () => {
  isLoadingServers.value = true;
  try {
    const response = await $api<{ data: Server[] }>("/servers");
    servers.value = response.data.filter((s) => s.connected);
  } catch {
    toast.error(t("operations.scripts.run.loadServersError"));
  } finally {
    isLoadingServers.value = false;
  }
};

const canSubmit = computed(() => {
  if (isLoading.value) return false;
  if (selectedServers.value.length === 0) return false;
  return true;
});

const toggleServer = (serverId: string) => {
  const index = selectedServers.value.indexOf(serverId);
  if (index === -1) {
    selectedServers.value.push(serverId);
  } else {
    selectedServers.value.splice(index, 1);
  }
};

const selectAll = () => {
  if (selectedServers.value.length === servers.value.length) {
    selectedServers.value = [];
  } else {
    selectedServers.value = servers.value.map((s) => s.id);
  }
};

const isSelected = (serverId: string) => {
  return selectedServers.value.includes(serverId);
};

const allSelected = computed(() => {
  return (
    servers.value.length > 0 &&
    selectedServers.value.length === servers.value.length
  );
});

const formatSelectedCount = (count: number) =>
  t(
    count === 1
      ? "operations.scripts.run.selectedOne"
      : "operations.scripts.run.selectedMany",
    { count: numberFormatter.value.format(count) },
  );

const formatRunButton = (count: number) =>
  t(
    count === 1
      ? "operations.scripts.run.runOnOne"
      : "operations.scripts.run.runOnMany",
    { count: numberFormatter.value.format(count) },
  );

const onSubmit = async () => {
  if (selectedServers.value.length === 0) {
    toast.error(t("operations.scripts.run.selectServerError"));
    return;
  }

  isLoading.value = true;
  try {
    const response = await $api<{ data: { batch_id: string } }>(
      `/scripts/${props.script.id}/execute`,
      {
        method: "POST",
        body: {
          server_ids: selectedServers.value,
          run_as: runAs.value,
        },
      },
    );

    // Store execution info and open monitor
    executionBatchId.value = response.data.batch_id;
    executionServerIds.value = [...selectedServers.value];

    const selectedCount = selectedServers.value.length;
    toast.success(
      t(
        selectedCount === 1
          ? "operations.scripts.run.startedOne"
          : "operations.scripts.run.startedMany",
        {
          name: props.script.name,
          count: numberFormatter.value.format(selectedCount),
        },
      ),
    );
    open.value = false;
    selectedServers.value = [];

    // Open execution monitor
    showMonitor.value = true;

    emit("ran");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("operations.scripts.run.runError"));
  } finally {
    isLoading.value = false;
  }
};

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      selectedServers.value = [];
      runAs.value = props.script.run_as || "root";
      fetchServers();
    }
  },
  { immediate: true },
);
</script>

<template>
  <!-- Execution Monitor -->
  <ScriptsExecutionMonitor
    v-model:open="showMonitor"
    :script-id="script.id"
    :script-name="script.name"
    :batch-id="executionBatchId"
    :server-ids="executionServerIds"
  />

  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ t("operations.scripts.run.title") }}</DialogTitle>
        <DialogDescription>
          {{ t("operations.scripts.run.description", { name: script.name }) }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <!-- Script preview -->
        <div class="rounded-lg border bg-muted/50 p-3">
          <p class="mb-2 text-sm font-medium">{{ script.name }}</p>
          <pre
            class="max-h-32 overflow-auto rounded bg-background p-2 text-xs"
          ><code>{{ script.content }}</code></pre>
        </div>

        <!-- Run as selection -->
        <div class="space-y-2">
          <Label>{{ t("operations.scripts.common.runAs") }}</Label>
          <Select v-model="runAs">
            <SelectTrigger>
              <SelectValue
                :placeholder="t('operations.scripts.run.userPlaceholder')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">{{
                t("operations.scripts.common.root")
              }}</SelectItem>
              <SelectItem value="local">{{
                t("operations.scripts.common.captain")
              }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Server selection -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>{{ t("operations.scripts.run.selectServers") }}</Label>
            <Button
              v-if="servers.length > 0"
              type="button"
              variant="ghost"
              size="sm"
              @click="selectAll"
            >
              {{
                allSelected
                  ? t("operations.scripts.run.deselectAll")
                  : t("operations.scripts.run.selectAll")
              }}
            </Button>
          </div>

          <div
            v-if="isLoadingServers"
            class="flex items-center justify-center py-8"
          >
            <Icon
              name="lucide:loader-2"
              class="h-6 w-6 animate-spin text-muted-foreground"
            />
          </div>

          <div
            v-else-if="servers.length === 0"
            class="rounded-lg border border-dashed p-6 text-center"
          >
            <Icon
              name="lucide:server-off"
              class="mx-auto h-8 w-8 text-muted-foreground"
            />
            <p class="mt-2 text-sm text-muted-foreground">
              {{ t("operations.scripts.run.noServers") }}
            </p>
          </div>

          <div v-else class="max-h-64 space-y-1.5 overflow-auto">
            <div
              v-for="server in servers"
              :key="server.id"
              class="flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors hover:bg-muted/50"
              :class="{ 'border-primary bg-primary/5': isSelected(server.id) }"
              @click="toggleServer(server.id)"
            >
              <Checkbox
                :model-value="isSelected(server.id)"
                :aria-label="
                  t('operations.scripts.run.selectServerAria', {
                    name: server.name,
                  })
                "
                @click.stop
                @update:model-value="toggleServer(server.id)"
              />
              <div class="flex flex-1 items-center justify-between">
                <div>
                  <p class="text-sm font-medium">{{ server.name }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ server.public_ipv4 }}
                  </p>
                </div>
                <Badge variant="outline" class="text-xs">
                  {{ getProviderLabel(server.provider) }}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <p
          v-if="selectedServers.length > 0"
          class="text-sm text-muted-foreground"
        >
          {{ formatSelectedCount(selectedServers.length) }}
        </p>
      </div>

      <DialogFooter class="mt-4">
        <Button type="button" variant="outline" @click="open = false">
          {{ t("operations.scripts.common.cancel") }}
        </Button>
        <Button :disabled="!canSubmit" @click="onSubmit">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:play" class="mr-2 h-4 w-4" />
          {{ formatRunButton(selectedServers.length) }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
