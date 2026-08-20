<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  installedPhpServiceId,
  phpDefaultEndpoint,
  phpPatchEndpoint,
} from "~/utils/phpVersions";

interface PhpExtension {
  value: string;
  label: string;
  status: string;
  is_installed: boolean;
  is_pending: boolean;
}

interface PhpOpcache {
  enable_cli: boolean;
  enabled: boolean;
  interned_strings_buffer: number;
  jit_buffer_size: string;
  jit_enabled: boolean;
  jit_mode: string;
  max_accelerated_files: number;
  memory_consumption: number;
  revalidate_freq: number;
  save_comments: boolean;
  status: string;
  validate_timestamps: boolean;
}

interface PhpDetails {
  id: string;
  server_id: string;
  type: string;
  type_label: string;
  name: string;
  version: string;
  status: string;
  status_label: string;
  is_default: boolean;
  software: string;
  software_label: string;
  extensions?: PhpExtension[];
  opcache?: PhpOpcache;
  created_at: string;
  updated_at: string;
}

interface PhpVersionData {
  key: string;
  display_name: string;
  version: string;
  is_installed: boolean;
  is_default: boolean;
  details?: PhpDetails;
}

interface Props {
  serverId: string;
}

const props = defineProps<Props>();
const { t } = useI18n();

const phpVersions = ref<PhpVersionData[]>([]);
const isLoading = ref(true);
const loadingStates = ref<Record<string, boolean>>({});
const selectedVersion = ref<string>("");
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// Dialog states
const extensionsDialogOpen = ref(false);
const extensionsDialogService = ref<PhpVersionData | null>(null);

const opcacheDialogOpen = ref(false);
const opcacheDialogService = ref<PhpVersionData | null>(null);

const fetchPhpVersions = async () => {
  try {
    const response = await $api<PhpVersionData[] | { data: PhpVersionData[] }>(
      `/servers/${props.serverId}/php`,
    );
    // Handle both array and { data: array } response formats
    phpVersions.value = Array.isArray(response)
      ? response
      : response.data || [];
  } catch {
    toast.error(t("server.settings.php.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const installedVersions = computed(() =>
  phpVersions.value.filter((v) => v.is_installed),
);
const availableVersions = computed(() =>
  phpVersions.value.filter((v) => !v.is_installed),
);

const isAnyInstalling = computed(() => {
  return phpVersions.value.some(
    (v) =>
      v.details?.status === "installing" ||
      v.details?.status === "pending" ||
      v.details?.status === "updating",
  );
});

const isServiceInstalling = (service: PhpVersionData) => {
  const status = service.details?.status;
  return (
    status === "installing" || status === "pending" || status === "updating"
  );
};

const serviceProgressLabel = (service: PhpVersionData) =>
  service.details?.status === "updating"
    ? t("server.settings.services.patching")
    : t("server.settings.installService.installing");

const handleAction = async (action: () => Promise<void>, version: string) => {
  loadingStates.value = { ...loadingStates.value, [version]: true };
  try {
    await action();
  } finally {
    loadingStates.value = { ...loadingStates.value, [version]: false };
  }
};

const installPhp = async (version: string) => {
  if (!version || !confirmationDialog.value) return;

  const versionData = phpVersions.value.find((v) => v.key === version);
  const { ok } = await confirmationDialog.value.show({
    title: t("server.settings.php.installTitle", {
      version: versionData?.display_name || version,
    }),
    description: t("server.settings.php.installDescription"),
    confirmText: t("server.settings.installService.install"),
    cancelText: t("server.common.cancel"),
  });

  if (ok) {
    await handleAction(async () => {
      await $api(`/servers/${props.serverId}/services`, {
        method: "POST",
        body: { software: version },
      });
      toast.success(t("server.settings.php.installStarted"));
      selectedVersion.value = "";
      fetchPhpVersions();
    }, version);
  }
};

const setDefault = async (php: PhpVersionData) => {
  if (!confirmationDialog.value) return;

  const serviceId = installedPhpServiceId(php);
  if (!serviceId) {
    toast.error(t("server.settings.php.identifyFailed"));
    return;
  }

  const { ok } = await confirmationDialog.value.show({
    title: t("server.settings.services.setDefaultTitle", {
      name: php.display_name,
    }),
    description: t("server.settings.services.setDefaultDescription"),
    confirmText: t("server.settings.services.setDefault"),
    cancelText: t("server.common.cancel"),
  });

  if (ok) {
    await handleAction(async () => {
      await $api(phpDefaultEndpoint(props.serverId, serviceId), {
        method: "POST",
      });
      toast.success(t("server.settings.services.defaultQueued"));
      fetchPhpVersions();
    }, php.key);
  }
};

const patchVersion = async (php: PhpVersionData) => {
  if (!confirmationDialog.value) return;

  const serviceId = installedPhpServiceId(php);
  if (!serviceId) {
    toast.error(t("server.settings.php.identifyFailed"));
    return;
  }

  const { ok } = await confirmationDialog.value.show({
    title: t("server.settings.services.patchTitle", { name: php.display_name }),
    description: t("server.settings.services.patchDescription"),
    confirmText: t("server.settings.services.patch"),
    cancelText: t("server.common.cancel"),
  });

  if (ok) {
    try {
      await handleAction(async () => {
        await $api(phpPatchEndpoint(props.serverId, serviceId), {
          method: "POST",
        });
        toast.success(
          t("server.settings.services.patchQueued", { name: php.display_name }),
        );
        await fetchPhpVersions();
      }, php.key);
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      toast.error(
        err.data?.message ||
          t("server.settings.services.patchFailed", { name: php.display_name }),
      );
    }
  }
};

const { user } = useAuth();
const teamId = computed(() => String(user.value?.current_team_id || ""));

useServiceEvents(teamId, (data, eventName) => {
  if (
    (eventName === "php.patch" || eventName === "php.default_changed") &&
    data.server_id === props.serverId
  ) {
    fetchPhpVersions();
  }
});

const uninstall = async (php: PhpVersionData) => {
  if (!confirmationDialog.value) return;

  const serviceId = installedPhpServiceId(php);
  if (!serviceId) {
    toast.error(t("server.settings.php.identifyFailed"));
    return;
  }

  const { ok } = await confirmationDialog.value.show({
    title: t("server.settings.services.uninstallTitle", {
      name: php.display_name,
    }),
    description: t("server.settings.php.uninstallDescription"),
    confirmText: t("server.settings.services.uninstall"),
    cancelText: t("server.common.cancel"),
    destructive: true,
  });

  if (ok) {
    await handleAction(async () => {
      await $api(`/servers/${props.serverId}/services/${serviceId}`, {
        method: "POST",
        body: { operation: "remove" },
      });
      toast.success(t("server.settings.php.uninstalled"));
      fetchPhpVersions();
    }, php.key);
  }
};

const openExtensionsDialog = (php: PhpVersionData) => {
  extensionsDialogService.value = php;
  extensionsDialogOpen.value = true;
};

const openOpcacheDialog = (php: PhpVersionData) => {
  opcacheDialogService.value = php;
  opcacheDialogOpen.value = true;
};

onMounted(fetchPhpVersions);
</script>

<template>
  <div class="w-full">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Extensions Dialog -->
    <ServerSettingsPhpExtensionsDialog
      v-if="extensionsDialogService"
      v-model:open="extensionsDialogOpen"
      :server-id="serverId"
      :service="extensionsDialogService"
      @updated="fetchPhpVersions"
    />

    <!-- OPcache Dialog -->
    <ServerSettingsPhpOpcacheDialog
      v-if="opcacheDialogService"
      v-model:open="opcacheDialogOpen"
      :server-id="serverId"
      :service="opcacheDialogService"
      @updated="fetchPhpVersions"
    />

    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <!-- Empty State -->
      <div
        v-if="installedVersions.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <div
          class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted"
        >
          <Icon name="lucide:package" class="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 class="mb-2 text-xl font-semibold">
          {{ t("server.settings.php.empty") }}
        </h2>
        <p class="mb-8 max-w-md text-muted-foreground">
          {{ t("server.settings.php.emptyDescription") }}
        </p>
        <div class="flex items-center gap-2">
          <Select v-model="selectedVersion">
            <SelectTrigger class="w-[180px]">
              <SelectValue
                :placeholder="t('server.settings.php.selectVersion')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="version in availableVersions"
                :key="version.key"
                :value="version.key"
              >
                {{ version.display_name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            :disabled="!selectedVersion || loadingStates[selectedVersion]"
            @click="installPhp(selectedVersion)"
          >
            <Icon
              v-if="loadingStates[selectedVersion]"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            <Icon v-else name="lucide:plus" class="mr-2 h-4 w-4" />
            {{ t("server.settings.php.install") }}
          </Button>
        </div>
      </div>

      <!-- PHP Versions Table -->
      <div v-else class="space-y-6">
        <!-- Header -->
        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">
              {{ t("server.settings.php.title") }}
            </h1>
            <p class="mt-1 text-sm text-muted-foreground sm:text-base">
              {{
                t("server.settings.php.installedCount", {
                  count: installedVersions.length,
                })
              }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Select
              v-model="selectedVersion"
              :disabled="isAnyInstalling || availableVersions.length === 0"
            >
              <SelectTrigger class="w-[140px] sm:w-[160px]">
                <SelectValue
                  :placeholder="t('server.settings.php.selectVersionShort')"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="version in availableVersions"
                  :key="version.key"
                  :value="version.key"
                  :disabled="loadingStates[version.key] || isAnyInstalling"
                >
                  {{ version.display_name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              :disabled="
                !selectedVersion ||
                loadingStates[selectedVersion] ||
                isAnyInstalling
              "
              @click="installPhp(selectedVersion)"
            >
              <Icon
                v-if="loadingStates[selectedVersion]"
                name="lucide:loader-2"
                class="mr-2 h-4 w-4 animate-spin"
              />
              <Icon v-else name="lucide:plus" class="mr-2 h-4 w-4" />
              {{ t("server.settings.installService.install") }}
            </Button>
          </div>
        </div>

        <!-- Table -->
        <div class="overflow-hidden rounded-lg border">
          <!-- Table Header - Hidden on mobile -->
          <div
            class="hidden border-b bg-muted/50 px-6 py-3 md:grid md:grid-cols-12 md:gap-4"
          >
            <div class="col-span-9 text-sm font-medium text-muted-foreground">
              {{ t("server.settings.services.version") }}
            </div>
            <div
              class="col-span-3 text-right text-sm font-medium text-muted-foreground"
            >
              {{ t("server.common.actions") }}
            </div>
          </div>

          <!-- Table Body -->
          <div class="divide-y">
            <div
              v-for="service in installedVersions"
              :key="service.key"
              :class="[
                'px-4 py-4 transition-colors md:px-6',
                isServiceInstalling(service)
                  ? 'bg-blue-50/50 dark:bg-blue-950/20'
                  : 'hover:bg-muted/30',
              ]"
            >
              <!-- Mobile Layout -->
              <div class="flex flex-col gap-4 md:hidden">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <!-- PHP Badge -->
                    <div
                      class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#777BB3]/10"
                    >
                      <span class="text-sm font-bold text-[#777BB3]">PHP</span>
                    </div>
                    <!-- Version Info -->
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium">{{
                          service.display_name
                        }}</span>
                        <Icon
                          v-if="service.is_default"
                          name="lucide:star"
                          class="h-4 w-4 fill-yellow-500 text-yellow-500"
                        />
                        <Badge
                          v-if="isServiceInstalling(service)"
                          variant="secondary"
                          class="gap-1.5"
                        >
                          <Icon
                            name="lucide:loader-2"
                            class="h-3 w-3 animate-spin"
                          />
                          {{ serviceProgressLabel(service) }}
                        </Badge>
                      </div>
                      <span
                        v-if="service.is_default"
                        class="text-xs text-muted-foreground"
                      >
                        {{ t("server.settings.php.defaultCli") }}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Icon
                      v-if="loadingStates[service.key]"
                      name="lucide:loader-2"
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button
                          variant="ghost"
                          size="sm"
                          :disabled="
                            loadingStates[service.key] ||
                            isServiceInstalling(service) ||
                            isAnyInstalling
                          "
                        >
                          <Icon name="lucide:more-horizontal" class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" class="w-48">
                        <template
                          v-if="service.details?.status === 'installed'"
                        >
                          <DropdownMenuItem @click="openOpcacheDialog(service)">
                            <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
                            OPcache
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            @click="openExtensionsDialog(service)"
                          >
                            <Icon name="lucide:package" class="mr-2 h-4 w-4" />
                            {{ t("server.settings.services.extensions") }}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </template>
                        <DropdownMenuItem
                          v-if="
                            !service.is_default &&
                            service.details?.status === 'installed'
                          "
                          @click="setDefault(service)"
                        >
                          <Icon name="lucide:star" class="mr-2 h-4 w-4" />
                          {{ t("server.settings.services.setDefault") }}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="!isServiceInstalling(service)"
                          @click="patchVersion(service)"
                        >
                          <Icon name="lucide:wrench" class="mr-2 h-4 w-4" />
                          {{ t("server.settings.services.patchVersion") }}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          class="text-destructive focus:text-destructive"
                          @click="uninstall(service)"
                        >
                          <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                          {{ t("server.settings.services.uninstall") }}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              <!-- Desktop Layout -->
              <div class="hidden items-center gap-4 md:grid md:grid-cols-12">
                <div class="col-span-9 flex items-center gap-3">
                  <!-- PHP Badge -->
                  <div
                    class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#777BB3]/10"
                  >
                    <span class="text-sm font-bold text-[#777BB3]">PHP</span>
                  </div>
                  <!-- Version Info -->
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-medium">{{
                        service.display_name
                      }}</span>
                      <Icon
                        v-if="service.is_default"
                        name="lucide:star"
                        class="h-4 w-4 fill-yellow-500 text-yellow-500"
                      />
                      <Badge
                        v-if="isServiceInstalling(service)"
                        variant="secondary"
                        class="gap-1.5"
                      >
                        <Icon
                          name="lucide:loader-2"
                          class="h-3 w-3 animate-spin"
                        />
                        {{ serviceProgressLabel(service) }}
                      </Badge>
                    </div>
                    <span
                      v-if="service.is_default"
                      class="text-xs text-muted-foreground"
                    >
                      {{ t("server.settings.php.defaultCli") }}
                    </span>
                  </div>
                </div>
                <div class="col-span-3 flex items-center justify-end gap-2">
                  <Icon
                    v-if="loadingStates[service.key]"
                    name="lucide:loader-2"
                    class="h-4 w-4 animate-spin text-muted-foreground"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button
                        variant="ghost"
                        size="sm"
                        :disabled="
                          loadingStates[service.key] ||
                          isServiceInstalling(service) ||
                          isAnyInstalling
                        "
                      >
                        <Icon name="lucide:more-horizontal" class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-48">
                      <template v-if="service.details?.status === 'installed'">
                        <DropdownMenuItem @click="openOpcacheDialog(service)">
                          <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
                          OPcache
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          @click="openExtensionsDialog(service)"
                        >
                          <Icon name="lucide:package" class="mr-2 h-4 w-4" />
                          {{ t("server.settings.services.extensions") }}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </template>
                      <DropdownMenuItem
                        v-if="
                          !service.is_default &&
                          service.details?.status === 'installed'
                        "
                        @click="setDefault(service)"
                      >
                        <Icon name="lucide:star" class="mr-2 h-4 w-4" />
                        {{ t("server.settings.services.setDefault") }}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-if="!isServiceInstalling(service)"
                        @click="patchVersion(service)"
                      >
                        <Icon name="lucide:wrench" class="mr-2 h-4 w-4" />
                        {{ t("server.settings.services.patchVersion") }}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        class="text-destructive focus:text-destructive"
                        @click="uninstall(service)"
                      >
                        <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                        {{ t("server.settings.services.uninstall") }}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
