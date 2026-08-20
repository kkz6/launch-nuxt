<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { usePhpExtensionEvents } from "~/composables/useChannelEvents";
import { installedPhpServiceId } from "~/utils/phpVersions";

interface PhpExtension {
  value: string;
  label: string;
  description?: string;
  status: string;
  is_installed: boolean;
  is_pending: boolean;
}

interface PhpDetails {
  id: string;
  server_id: string;
  type: string;
  name: string;
  version: string;
  status: string;
  software: string;
  extensions?: PhpExtension[];
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
  service: PhpVersionData;
}

const props = defineProps<Props>();
const { t } = useI18n();

const extensionDescriptionKeys: Record<string, string> = {
  bcmath: "bcmath",
  bz2: "bz2",
  curl: "curl",
  dba: "dba",
  enchant: "enchant",
  gd: "gd",
  gmp: "gmp",
  igbinary: "igbinary",
  imagick: "imagick",
  imap: "imap",
  intl: "intl",
  ldap: "ldap",
  mbstring: "mbstring",
  memcached: "memcached",
  mongodb: "mongodb",
  msgpack: "msgpack",
  mysql: "mysql",
  odbc: "odbc",
  opcache: "opcache",
  pgsql: "pgsql",
  pspell: "pspell",
  readline: "readline",
  redis: "redis",
  snmp: "snmp",
  soap: "soap",
  sqlite3: "sqlite3",
  tidy: "tidy",
  xdebug: "xdebug",
  xml: "xml",
  xsl: "xsl",
  zip: "zip",
};

const extensionDescription = (extension: PhpExtension): string => {
  const key = extensionDescriptionKeys[extension.value];
  return key
    ? t(`server.settings.phpExtensions.descriptions.${key}`)
    : (extension.description ?? "");
};

const emit = defineEmits<{
  updated: [];
}>();

const open = defineModel<boolean>("open", { required: true });

const searchQuery = ref("");
const loadingStates = ref<Record<string, boolean>>({});
const confirmDialog = ref<{
  open: boolean;
  action: "install" | "uninstall";
  extension: PhpExtension | null;
}>({ open: false, action: "install", extension: null });

// Listen for WebSocket events to refresh data when extension operations complete
usePhpExtensionEvents(
  computed(() => props.serverId),
  () => {
    // Refresh extensions data when install/uninstall completes
    emit("updated");
  },
);

// Format PHP version from "php84" or "8.4" to "8.4"
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

const handleInstall = async (extension: string) => {
  const serviceId = installedPhpServiceId(props.service);
  if (!serviceId) {
    toast.error(t("server.settings.php.identifyFailed"));
    return;
  }

  loadingStates.value = { ...loadingStates.value, [extension]: true };
  try {
    await $api(`/servers/${props.serverId}/php/${serviceId}/extensions`, {
      method: "POST",
      body: { extension },
    });
    toast.success(t("server.settings.phpExtensions.installStarted"));
    emit("updated");
  } catch {
    toast.error(t("server.settings.phpExtensions.installFailed"));
  } finally {
    loadingStates.value = { ...loadingStates.value, [extension]: false };
  }
};

const handleUninstall = async (extension: string) => {
  const serviceId = installedPhpServiceId(props.service);
  if (!serviceId) {
    toast.error(t("server.settings.php.identifyFailed"));
    return;
  }

  loadingStates.value = { ...loadingStates.value, [extension]: true };
  try {
    await $api(
      `/servers/${props.serverId}/php/${serviceId}/extensions/${extension}`,
      {
        method: "DELETE",
      },
    );
    toast.success(t("server.settings.phpExtensions.uninstallStarted"));
    emit("updated");
  } catch {
    toast.error(t("server.settings.phpExtensions.uninstallFailed"));
  } finally {
    loadingStates.value = { ...loadingStates.value, [extension]: false };
  }
};

const confirmAction = () => {
  if (confirmDialog.value.extension) {
    if (confirmDialog.value.action === "install") {
      handleInstall(confirmDialog.value.extension.value);
    } else {
      handleUninstall(confirmDialog.value.extension.value);
    }
  }
  confirmDialog.value = { open: false, action: "install", extension: null };
};

const extensions = computed(() => props.service.details?.extensions || []);
const pendingCount = computed(
  () => extensions.value.filter((e) => e.is_pending).length,
);

// Filter and separate extensions
const filteredExtensions = computed(() => {
  const query = searchQuery.value.toLowerCase();
  return extensions.value.filter(
    (ext) =>
      ext.label.toLowerCase().includes(query) ||
      ext.value.toLowerCase().includes(query) ||
      extensionDescription(ext).toLowerCase().includes(query),
  );
});

const installedExtensions = computed(() =>
  filteredExtensions.value.filter((e) => e.is_installed || e.is_pending),
);

const availableExtensions = computed(() =>
  filteredExtensions.value.filter((e) => !e.is_installed && !e.is_pending),
);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="lucide:package" class="h-5 w-5" />
          {{
            t("server.settings.phpExtensions.title", {
              version: formatPhpVersion(
                service.details?.version || service.key,
              ),
            })
          }}
        </DialogTitle>
        <DialogDescription>
          {{ t("server.settings.phpExtensions.description") }}
          <span
            v-if="pendingCount > 0"
            class="ml-1 text-amber-600 dark:text-amber-400"
          >
            {{
              t("server.settings.phpExtensions.inProgress", {
                count: pendingCount,
              })
            }}
          </span>
        </DialogDescription>
      </DialogHeader>

      <!-- Search -->
      <div class="relative">
        <Icon
          name="lucide:search"
          class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="searchQuery"
          :placeholder="t('server.settings.phpExtensions.search')"
          class="pl-9"
        />
      </div>

      <div class="max-h-[450px] space-y-4 overflow-y-auto pr-1">
        <!-- Installed Extensions -->
        <div v-if="installedExtensions.length > 0">
          <h3
            class="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground"
          >
            <Icon name="lucide:check-circle" class="h-4 w-4 text-emerald-500" />
            {{
              t("server.settings.phpExtensions.installed", {
                count: installedExtensions.length,
              })
            }}
          </h3>
          <div class="grid gap-2">
            <div
              v-for="ext in installedExtensions"
              :key="ext.value"
              :class="[
                'flex items-center justify-between rounded-lg border bg-emerald-50/50 p-3 dark:bg-emerald-950/20',
                'dark:border-emerald-900/30',
                ext.is_pending && 'opacity-70',
              ]"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">{{ ext.label }}</span>
                  <Badge
                    v-if="ext.is_pending"
                    variant="secondary"
                    class="gap-1 text-xs"
                  >
                    <Icon name="lucide:loader-2" class="h-3 w-3 animate-spin" />
                    {{
                      ext.status === "installing"
                        ? t("server.settings.installService.installing")
                        : t("server.settings.phpExtensions.removing")
                    }}
                  </Badge>
                  <Badge
                    v-else-if="ext.status === 'failed'"
                    variant="destructive"
                    class="gap-1 text-xs"
                  >
                    <Icon name="lucide:x" class="h-3 w-3" />
                    {{ t("server.settings.serviceStatus.failed") }}
                  </Badge>
                </div>
                <p
                  v-if="extensionDescription(ext)"
                  class="mt-0.5 text-xs text-muted-foreground"
                >
                  {{ extensionDescription(ext) }}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                class="ml-3 h-8 w-8 shrink-0 p-0 text-red-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/30"
                :disabled="loadingStates[ext.value] || ext.is_pending"
                @click="
                  confirmDialog = {
                    open: true,
                    action: 'uninstall',
                    extension: ext,
                  }
                "
              >
                <Icon
                  v-if="loadingStates[ext.value]"
                  name="lucide:loader-2"
                  class="h-4 w-4 animate-spin"
                />
                <Icon v-else name="lucide:trash-2" class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Available Extensions -->
        <div v-if="availableExtensions.length > 0">
          <h3
            class="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground"
          >
            <Icon name="lucide:download" class="h-4 w-4" />
            {{
              t("server.settings.phpExtensions.available", {
                count: availableExtensions.length,
              })
            }}
          </h3>
          <div class="grid gap-2">
            <div
              v-for="ext in availableExtensions"
              :key="ext.value"
              class="flex items-center justify-between rounded-lg border p-3 dark:bg-[#1C1C1C] dark:border-[#2B2B2B]"
            >
              <div class="min-w-0 flex-1">
                <span class="text-sm font-medium">{{ ext.label }}</span>
                <p
                  v-if="extensionDescription(ext)"
                  class="mt-0.5 text-xs text-muted-foreground"
                >
                  {{ extensionDescription(ext) }}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                class="ml-3 h-8 shrink-0 text-xs"
                :disabled="loadingStates[ext.value]"
                @click="
                  confirmDialog = {
                    open: true,
                    action: 'install',
                    extension: ext,
                  }
                "
              >
                <Icon
                  v-if="loadingStates[ext.value]"
                  name="lucide:loader-2"
                  class="mr-1.5 h-3.5 w-3.5 animate-spin"
                />
                <Icon v-else name="lucide:plus" class="mr-1.5 h-3.5 w-3.5" />
                {{ t("server.settings.installService.install") }}
              </Button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="filteredExtensions.length === 0"
          class="py-8 text-center text-muted-foreground"
        >
          <Icon
            name="lucide:package-x"
            class="mx-auto mb-2 h-8 w-8 opacity-50"
          />
          <p v-if="searchQuery">
            {{
              t("server.settings.phpExtensions.noMatch", { query: searchQuery })
            }}
          </p>
          <p v-else>{{ t("server.settings.phpExtensions.empty") }}</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Confirmation Dialog -->
  <AlertDialog
    :open="confirmDialog.open"
    @update:open="(open) => (confirmDialog = { ...confirmDialog, open })"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{
            confirmDialog.action === "install"
              ? t("server.settings.phpExtensions.installTitle")
              : t("server.settings.phpExtensions.uninstallTitle")
          }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          <template v-if="confirmDialog.action === 'install'">
            {{ t("server.settings.phpExtensions.installConfirmPrefix") }}
            <strong>{{ confirmDialog.extension?.label }}</strong
            >?
            {{ t("server.settings.phpExtensions.installConfirmSuffix") }}
          </template>
          <template v-else>
            {{ t("server.settings.phpExtensions.uninstallConfirmPrefix") }}
            <strong>{{ confirmDialog.extension?.label }}</strong
            >?
            {{ t("server.settings.phpExtensions.uninstallConfirmSuffix") }}
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t("server.common.cancel") }}</AlertDialogCancel>
        <AlertDialogAction
          :class="
            confirmDialog.action === 'uninstall'
              ? 'bg-red-600 hover:bg-red-700'
              : ''
          "
          @click="confirmAction"
        >
          {{
            confirmDialog.action === "install"
              ? t("server.settings.installService.install")
              : t("server.settings.services.uninstall")
          }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
