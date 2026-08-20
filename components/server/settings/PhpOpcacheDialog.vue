<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { installedPhpServiceId } from "~/utils/phpVersions";

interface OpcacheSettings {
  enabled: boolean;
  enable_cli: boolean;
  memory_consumption: number;
  interned_strings_buffer: number;
  max_accelerated_files: number;
  validate_timestamps: boolean;
  revalidate_freq: number;
  save_comments: boolean;
  jit_enabled: boolean;
  jit_buffer_size: string;
  jit_mode: string;
}

interface OpcacheStatus {
  enabled: boolean;
  error?: string;
  cache_full?: boolean;
  restart_pending?: boolean;
  restart_in_progress?: boolean;
  memory?: {
    used_memory: number;
    free_memory: number;
    wasted_memory: number;
    current_wasted_percentage: number;
  };
  statistics?: {
    num_cached_scripts: number;
    num_cached_keys: number;
    max_cached_keys: number;
    hits: number;
    misses: number;
    hit_rate: number;
  };
  interned_strings?: {
    buffer_size: number;
    used_memory: number;
    free_memory: number;
    number_of_strings: number;
  };
  jit?: {
    enabled: boolean;
    on: boolean;
    buffer_size: number;
    buffer_free: number;
  };
}

interface PhpService {
  id: string;
  status: string;
  version: string;
  opcache?: OpcacheSettings;
}

interface PhpVersionData {
  key: string;
  display_name: string;
  is_installed: boolean;
  is_default: boolean;
  details?: PhpService;
}

interface Props {
  serverId: string;
  service: PhpVersionData;
}

const props = defineProps<Props>();
const { t } = useI18n();

const emit = defineEmits<{
  updated: [];
}>();

const open = defineModel<boolean>("open", { required: true });

const activeTab = ref("status");
const status = ref<OpcacheStatus | null>(null);
const statusLoading = ref(false);
const resetLoading = ref(false);
const submitting = ref(false);
const hasLoadedStatus = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const defaultSettings: OpcacheSettings = {
  enabled: true,
  enable_cli: false,
  memory_consumption: 128,
  interned_strings_buffer: 16,
  max_accelerated_files: 10000,
  validate_timestamps: true,
  revalidate_freq: 2,
  save_comments: true,
  jit_enabled: false,
  jit_buffer_size: "100M",
  jit_mode: "tracing",
};

const form = ref<OpcacheSettings>({ ...defaultSettings });

// Initialize form from service props
const initializeForm = () => {
  const opcache = props.service?.details?.opcache;
  form.value = {
    enabled: opcache?.enabled ?? defaultSettings.enabled,
    enable_cli: opcache?.enable_cli ?? defaultSettings.enable_cli,
    memory_consumption:
      opcache?.memory_consumption ?? defaultSettings.memory_consumption,
    interned_strings_buffer:
      opcache?.interned_strings_buffer ??
      defaultSettings.interned_strings_buffer,
    max_accelerated_files:
      opcache?.max_accelerated_files ?? defaultSettings.max_accelerated_files,
    validate_timestamps:
      opcache?.validate_timestamps ?? defaultSettings.validate_timestamps,
    revalidate_freq:
      opcache?.revalidate_freq ?? defaultSettings.revalidate_freq,
    save_comments: opcache?.save_comments ?? defaultSettings.save_comments,
    jit_enabled: opcache?.jit_enabled ?? defaultSettings.jit_enabled,
    jit_buffer_size:
      opcache?.jit_buffer_size ?? defaultSettings.jit_buffer_size,
    jit_mode: opcache?.jit_mode ?? defaultSettings.jit_mode,
  };
  // Reset status when service changes
  status.value = null;
  hasLoadedStatus.value = false;
  activeTab.value = "status";
};

// Re-initialize when dialog opens or service changes
watch(
  () => props.service?.key,
  () => {
    if (open.value) {
      initializeForm();
    }
  },
);

watch(open, (isOpen) => {
  if (isOpen) {
    initializeForm();
  }
});

// Format PHP version from "php84" to "8.4"
const formatPhpVersion = (version: string): string => {
  if (version.startsWith("php")) {
    const numericPart = version.replace("php", "");
    if (numericPart.length === 2) {
      return `${numericPart[0]}.${numericPart[1]}`;
    }
    return numericPart;
  }
  return version;
};

const phpVersion = computed(() =>
  formatPhpVersion(props.service?.details?.version || props.service?.key || ""),
);
const supportsJit = computed(() => parseFloat(phpVersion.value) >= 8.0);

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const getServiceId = () => {
  const serviceId = installedPhpServiceId(props.service);
  if (!serviceId) {
    toast.error(t("server.settings.php.identifyFailed"));
  }
  return serviceId;
};

const fetchStatus = async () => {
  const serviceId = getServiceId();
  if (!serviceId) return;

  statusLoading.value = true;
  try {
    const response = await $api<{ data: OpcacheStatus }>(
      `/servers/${props.serverId}/php/${serviceId}/opcache/status`,
    );
    status.value = response.data;
    hasLoadedStatus.value = true;
  } catch {
    status.value = {
      enabled: false,
      error: t("server.settings.opcache.fetchFailed"),
    };
    hasLoadedStatus.value = true;
  } finally {
    statusLoading.value = false;
  }
};

const handleReset = async () => {
  if (!confirmationDialog.value) return;
  const serviceId = getServiceId();
  if (!serviceId) return;

  const result = await confirmationDialog.value.show({
    title: t("server.settings.opcache.resetTitle"),
    description: t("server.settings.opcache.resetDescription"),
    confirmText: t("server.settings.opcache.reset"),
    cancelText: t("server.common.cancel"),
  });

  if (!result.ok) return;

  resetLoading.value = true;
  try {
    await $api(`/servers/${props.serverId}/php/${serviceId}/opcache/reset`, {
      method: "POST",
    });
    toast.success(t("server.settings.opcache.resetStarted"));
    await fetchStatus();
  } catch {
    toast.error(t("server.settings.opcache.resetFailed"));
  } finally {
    resetLoading.value = false;
  }
};

const handleSubmit = async () => {
  if (!confirmationDialog.value) return;
  const serviceId = getServiceId();
  if (!serviceId) return;

  const isEnabling =
    form.value.enabled && !props.service?.details?.opcache?.enabled;
  const isDisabling =
    !form.value.enabled && props.service?.details?.opcache?.enabled;

  let description = t("server.settings.opcache.applyDescription");
  if (isDisabling) {
    description = t("server.settings.opcache.disableDescription");
  } else if (isEnabling) {
    description = t("server.settings.opcache.enableDescription");
  }

  const result = await confirmationDialog.value.show({
    title: t("server.settings.opcache.applyTitle"),
    description,
    confirmText: t("server.settings.opcache.apply"),
    cancelText: t("server.common.cancel"),
  });

  if (!result.ok) return;

  submitting.value = true;
  try {
    await $api(
      `/servers/${props.serverId}/php/${serviceId}/opcache/configure`,
      {
        method: "POST",
        body: form.value,
      },
    );
    toast.success(t("server.settings.opcache.updated"));
    activeTab.value = "status";
    emit("updated");
  } catch {
    toast.error(t("server.settings.opcache.updateFailed"));
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="lucide:zap" class="h-5 w-5" />
          OPcache - PHP {{ phpVersion }}
        </DialogTitle>
        <DialogDescription>
          {{ t("server.settings.opcache.description") }}
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="status">{{
            t("server.common.status")
          }}</TabsTrigger>
          <TabsTrigger value="configure">{{
            t("server.settings.opcache.configure")
          }}</TabsTrigger>
        </TabsList>

        <TabsContent value="status" class="space-y-4">
          <!-- Initial state - show refresh button -->
          <div
            v-if="!hasLoadedStatus && !statusLoading"
            class="flex flex-col items-center justify-center py-12 text-center"
          >
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted"
            >
              <Icon name="lucide:zap" class="h-6 w-6 text-muted-foreground" />
            </div>
            <p class="mb-4 text-muted-foreground">
              {{ t("server.settings.opcache.fetchHelp") }}
            </p>
            <Button :disabled="statusLoading" @click="fetchStatus">
              <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
              {{ t("server.settings.opcache.refreshStatus") }}
            </Button>
          </div>

          <!-- Loading state -->
          <div
            v-else-if="statusLoading"
            class="flex flex-col items-center justify-center py-12 text-center"
          >
            <Icon
              name="lucide:loader-2"
              class="mb-4 h-8 w-8 animate-spin text-muted-foreground"
            />
            <p class="text-muted-foreground">
              {{ t("server.settings.opcache.fetching") }}
            </p>
          </div>

          <!-- Error state -->
          <div v-else-if="status?.error" class="space-y-4">
            <div
              class="flex items-center gap-2 rounded-lg bg-amber-50 p-4 text-amber-600 dark:bg-amber-950/20"
            >
              <Icon name="lucide:alert-circle" class="h-5 w-5" />
              <span>{{ status.error }}</span>
            </div>
            <div class="flex justify-center">
              <Button
                variant="outline"
                :disabled="statusLoading"
                @click="fetchStatus"
              >
                <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
                {{ t("server.provisionStatus.tryAgain") }}
              </Button>
            </div>
          </div>

          <!-- Success state - show status data -->
          <template v-else-if="status">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Badge :variant="status.enabled ? 'default' : 'secondary'">
                  {{
                    status.enabled
                      ? t("server.common.enabled")
                      : t("server.common.disabled")
                  }}
                </Badge>
                <Badge
                  v-if="status.jit?.enabled"
                  variant="outline"
                  class="text-xs"
                >
                  {{ t("server.settings.opcache.jitActive") }}
                </Badge>
              </div>
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="statusLoading"
                  @click="fetchStatus"
                >
                  <Icon
                    name="lucide:refresh-cw"
                    :class="['h-4 w-4', statusLoading && 'animate-spin']"
                  />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  :disabled="resetLoading"
                  @click="handleReset"
                >
                  <Icon
                    v-if="resetLoading"
                    name="lucide:loader-2"
                    class="mr-1 h-4 w-4 animate-spin"
                  />
                  <Icon v-else name="lucide:refresh-cw" class="mr-1 h-4 w-4" />
                  {{ t("server.settings.opcache.resetCache") }}
                </Button>
              </div>
            </div>

            <div v-if="status.enabled" class="grid grid-cols-2 gap-3">
              <!-- Memory Used -->
              <div
                class="flex items-center gap-3 rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]"
              >
                <div class="rounded-md bg-primary/10 p-2">
                  <Icon name="lucide:hard-drive" class="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">
                    {{ t("server.settings.opcache.memoryUsed") }}
                  </p>
                  <p class="font-medium">
                    {{ formatBytes(status.memory?.used_memory || 0) }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{
                      t("server.settings.opcache.free", {
                        size: formatBytes(status.memory?.free_memory || 0),
                      })
                    }}
                  </p>
                </div>
              </div>

              <!-- Hit Rate -->
              <div
                class="flex items-center gap-3 rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]"
              >
                <div class="rounded-md bg-primary/10 p-2">
                  <Icon name="lucide:activity" class="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">
                    {{ t("server.settings.opcache.hitRate") }}
                  </p>
                  <p class="font-medium">
                    {{ (status.statistics?.hit_rate || 0).toFixed(1) }}%
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{
                      t("server.settings.opcache.hits", {
                        count: status.statistics?.hits || 0,
                      })
                    }}
                  </p>
                </div>
              </div>

              <!-- Cached Scripts -->
              <div
                class="flex items-center gap-3 rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]"
              >
                <div class="rounded-md bg-primary/10 p-2">
                  <Icon name="lucide:cpu" class="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">
                    {{ t("server.settings.opcache.cachedScripts") }}
                  </p>
                  <p class="font-medium">
                    {{ status.statistics?.num_cached_scripts || 0 }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{
                      t("server.settings.opcache.maxKeys", {
                        count: status.statistics?.max_cached_keys || 0,
                      })
                    }}
                  </p>
                </div>
              </div>

              <!-- JIT Buffer -->
              <div
                v-if="status.jit?.enabled"
                class="flex items-center gap-3 rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]"
              >
                <div class="rounded-md bg-primary/10 p-2">
                  <Icon name="lucide:zap" class="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">
                    {{ t("server.settings.opcache.jitBuffer") }}
                  </p>
                  <p class="font-medium">
                    {{
                      formatBytes(
                        (status.jit?.buffer_size || 0) -
                          (status.jit?.buffer_free || 0),
                      )
                    }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{
                      t("server.settings.opcache.free", {
                        size: formatBytes(status.jit?.buffer_free || 0),
                      })
                    }}
                  </p>
                </div>
              </div>
            </div>
          </template>
        </TabsContent>

        <TabsContent value="configure">
          <form class="space-y-4" @submit.prevent="handleSubmit">
            <div class="max-h-[400px] space-y-4 overflow-y-auto pr-1">
              <!-- Enable OPcache -->
              <div
                class="flex items-center justify-between rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]"
              >
                <div>
                  <Label class="font-medium">{{
                    t("server.settings.opcache.enable")
                  }}</Label>
                  <p class="text-xs text-muted-foreground">
                    {{ t("server.settings.opcache.enableHelp") }}
                  </p>
                </div>
                <Switch v-model="form.enabled" />
              </div>

              <!-- Enable CLI -->
              <div
                class="flex items-center justify-between rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]"
              >
                <div>
                  <Label class="font-medium">{{
                    t("server.settings.opcache.enableCli")
                  }}</Label>
                  <p class="text-xs text-muted-foreground">
                    {{ t("server.settings.opcache.enableCliHelp") }}
                  </p>
                </div>
                <Switch v-model="form.enable_cli" />
              </div>

              <!-- Memory Consumption -->
              <div class="space-y-2">
                <Label>{{
                  t("server.settings.opcache.memoryConsumption")
                }}</Label>
                <Input v-model="form.memory_consumption" type="number" />
                <p class="text-xs text-muted-foreground">
                  {{ t("server.settings.opcache.memoryConsumptionHelp") }}
                </p>
              </div>

              <!-- Interned Strings Buffer -->
              <div class="space-y-2">
                <Label>{{ t("server.settings.opcache.internedBuffer") }}</Label>
                <Input v-model="form.interned_strings_buffer" type="number" />
                <p class="text-xs text-muted-foreground">
                  {{ t("server.settings.opcache.internedBufferHelp") }}
                </p>
              </div>

              <!-- Max Accelerated Files -->
              <div class="space-y-2">
                <Label>{{ t("server.settings.opcache.maxFiles") }}</Label>
                <Input v-model="form.max_accelerated_files" type="number" />
                <p class="text-xs text-muted-foreground">
                  {{ t("server.settings.opcache.maxFilesHelp") }}
                </p>
              </div>

              <!-- Validate Timestamps -->
              <div
                class="flex items-center justify-between rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]"
              >
                <div>
                  <Label class="font-medium">{{
                    t("server.settings.opcache.validateTimestamps")
                  }}</Label>
                  <p class="text-xs text-muted-foreground">
                    {{ t("server.settings.opcache.validateTimestampsHelp") }}
                  </p>
                </div>
                <Switch v-model="form.validate_timestamps" />
              </div>

              <!-- Revalidate Frequency -->
              <div v-if="form.validate_timestamps" class="space-y-2">
                <Label>{{
                  t("server.settings.opcache.revalidateFrequency")
                }}</Label>
                <Input v-model="form.revalidate_freq" type="number" />
                <p class="text-xs text-muted-foreground">
                  {{ t("server.settings.opcache.revalidateFrequencyHelp") }}
                </p>
              </div>

              <!-- Save Comments -->
              <div
                class="flex items-center justify-between rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]"
              >
                <div>
                  <Label class="font-medium">{{
                    t("server.settings.opcache.saveComments")
                  }}</Label>
                  <p class="text-xs text-muted-foreground">
                    {{ t("server.settings.opcache.saveCommentsHelp") }}
                  </p>
                </div>
                <Switch v-model="form.save_comments" />
              </div>

              <!-- JIT Section (PHP 8.0+) -->
              <template v-if="supportsJit">
                <div class="border-t pt-2">
                  <h4 class="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Icon name="lucide:zap" class="h-4 w-4" />
                    {{ t("server.settings.opcache.jitCompiler") }}
                  </h4>
                </div>

                <!-- Enable JIT -->
                <div
                  class="flex items-center justify-between rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]"
                >
                  <div>
                    <Label class="font-medium">{{
                      t("server.settings.opcache.enableJit")
                    }}</Label>
                    <p class="text-xs text-muted-foreground">
                      {{ t("server.settings.opcache.enableJitHelp") }}
                    </p>
                  </div>
                  <Switch v-model="form.jit_enabled" />
                </div>

                <template v-if="form.jit_enabled">
                  <!-- JIT Buffer Size -->
                  <div class="space-y-2">
                    <Label>{{
                      t("server.settings.opcache.jitBufferSize")
                    }}</Label>
                    <Input v-model="form.jit_buffer_size" />
                    <p class="text-xs text-muted-foreground">
                      {{ t("server.settings.opcache.jitBufferSizeHelp") }}
                    </p>
                  </div>

                  <!-- JIT Mode -->
                  <div class="space-y-2">
                    <Label>{{ t("server.settings.opcache.jitMode") }}</Label>
                    <Select v-model="form.jit_mode">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disable">{{
                          t("server.settings.opcache.disable")
                        }}</SelectItem>
                        <SelectItem value="tracing">{{
                          t("server.settings.opcache.tracing")
                        }}</SelectItem>
                        <SelectItem value="function">{{
                          t("server.settings.opcache.function")
                        }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </template>
              </template>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" @click="open = false">
                {{ t("server.common.cancel") }}
              </Button>
              <Button type="submit" :disabled="submitting">
                <Icon
                  v-if="submitting"
                  name="lucide:loader-2"
                  class="mr-2 h-4 w-4 animate-spin"
                />
                <Icon v-else name="lucide:settings" class="mr-2 h-4 w-4" />
                {{ t("server.settings.opcache.applyConfiguration") }}
              </Button>
            </DialogFooter>
          </form>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
