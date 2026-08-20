<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
import { formatDistanceToNow } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import type { Server } from "~/types";

interface ArchivedServer {
  id: string;
  name: string;
  public_ipv4: string;
  provider: string;
  archived_at: string;
}

const activeServers = ref<Server[]>([]);
const { locale, t } = useI18n();
const dateLocale = computed(() => (locale.value === "ja" ? ja : enUS));
const archivedServers = ref<ArchivedServer[]>([]);
const selectedServerId = ref("");
const selectedServerSiteCount = ref(0);
const isLoadingServers = ref(true);
const isLoadingArchived = ref(true);
const archiveLoading = ref(false);
const showArchiveConfirm = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const providerLabels: Record<string, string> = {
  aws: "AWS",
  digitalocean: "DigitalOcean",
  linode: "Linode",
  vultr: "Vultr",
  hetzner: "Hetzner",
  custom_server: "settings.danger.customServer",
};

const providerLabel = (provider: string) => {
  const label = providerLabels[provider];
  if (!label) return provider;
  return label.startsWith("settings.") ? t(label) : label;
};

const selectedServer = computed(() => {
  return activeServers.value.find((s) => s.id === selectedServerId.value);
});

const fetchActiveServers = async () => {
  isLoadingServers.value = true;
  try {
    const response = await $api<{ data: Server[] }>("/servers");
    activeServers.value = response.data;
  } catch {
    // Silent fail
  } finally {
    isLoadingServers.value = false;
  }
};

const fetchArchivedServers = async () => {
  isLoadingArchived.value = true;
  try {
    const response = await $api<{ data: ArchivedServer[] }>(
      "/servers/archived",
    );
    archivedServers.value = response.data;
  } catch {
    toast.error(t("settings.danger.loadArchivedFailed"));
  } finally {
    isLoadingArchived.value = false;
  }
};

watch(selectedServerId, async (id) => {
  if (!id) {
    selectedServerSiteCount.value = 0;
    return;
  }
  try {
    const data = await $api<{ data: { count: number } }>(
      `/servers/${id}/site-count`,
    );
    selectedServerSiteCount.value = data.data?.count || 0;
  } catch {
    selectedServerSiteCount.value = 0;
  }
});

const archiveServer = async () => {
  if (!selectedServerId.value) return;

  archiveLoading.value = true;
  try {
    await $api(`/servers/${selectedServerId.value}/archive`, {
      method: "POST",
    });
    toast.success(t("settings.danger.archiveStarted"));
    showArchiveConfirm.value = false;

    // Move server from active to archived list
    const server = selectedServer.value;
    if (server) {
      activeServers.value = activeServers.value.filter(
        (s) => s.id !== server.id,
      );
      archivedServers.value.unshift({
        id: server.id,
        name: server.name,
        public_ipv4: server.public_ipv4,
        provider: server.provider,
        archived_at: new Date().toISOString(),
      });
    }
    selectedServerId.value = "";
    selectedServerSiteCount.value = 0;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("settings.danger.archiveFailed"));
  } finally {
    archiveLoading.value = false;
  }
};

const restoreServer = async (server: ArchivedServer) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.danger.restoreTitle"),
    description: t("settings.danger.restoreDescription", { name: server.name }),
    confirmText: t("settings.danger.restore"),
    cancelText: t("settings.danger.cancel"),
  });

  if (result.ok) {
    try {
      await $api(`/servers/${server.id}/restore`, { method: "POST" });
      archivedServers.value = archivedServers.value.filter(
        (s) => s.id !== server.id,
      );
      toast.success(t("settings.danger.restored"));
      fetchActiveServers();
    } catch {
      toast.error(t("settings.danger.restoreFailed"));
    }
  }
};

const deleteServer = async (server: ArchivedServer) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.danger.deletePermanentlyTitle"),
    description: t("settings.danger.deletePermanentlyDescription", {
      name: server.name,
    }),
    confirmText: t("settings.danger.deletePermanently"),
    cancelText: t("settings.danger.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/servers/${server.id}`, { method: "DELETE" });
      archivedServers.value = archivedServers.value.filter(
        (s) => s.id !== server.id,
      );
      toast.success(t("settings.danger.deletedPermanently"));
    } catch {
      toast.error(t("settings.danger.deleteFailed"));
    }
  }
};

// Role gating — archiving / deleting servers is admin/owner only.
const { canDelete } = useCan();

onMounted(() => {
  fetchActiveServers();
  fetchArchivedServers();
});
</script>

<template>
  <div
    v-if="!canDelete"
    class="flex items-start gap-3 px-6 py-10 text-sm text-muted-foreground"
  >
    <Icon name="lucide:lock" class="mt-0.5 h-4 w-4 shrink-0" />
    <p>
      {{ t("settings.danger.permissionRequired") }}
    </p>
  </div>

  <div v-else class="divide-y">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Archive a Server Section -->
    <div class="px-6 pb-6">
      <h3 class="mb-1 text-base font-semibold">
        {{ t("settings.danger.archiveTitle") }}
      </h3>
      <p class="mb-4 text-sm text-muted-foreground">
        {{ t("settings.danger.archiveDescription") }}
      </p>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label>{{ t("settings.danger.server") }}</Label>
          <Select v-model="selectedServerId">
            <SelectTrigger>
              <SelectValue :placeholder="t('settings.danger.selectServer')" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <template v-if="isLoadingServers">
                  <SelectLabel class="text-muted-foreground">{{
                    t("settings.danger.loadingServers")
                  }}</SelectLabel>
                </template>
                <template v-else-if="activeServers.length > 0">
                  <SelectItem
                    v-for="server in activeServers"
                    :key="server.id"
                    :value="server.id"
                  >
                    {{ server.name }} ({{ server.public_ipv4 }})
                  </SelectItem>
                </template>
                <template v-else>
                  <SelectLabel class="text-muted-foreground">{{
                    t("settings.danger.noServers")
                  }}</SelectLabel>
                </template>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div
          v-if="selectedServerId && selectedServerSiteCount > 0"
          class="flex items-start gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-950/50"
        >
          <div class="space-y-1">
            <p class="text-sm font-medium text-blue-800 dark:text-blue-200">
              {{ t("settings.danger.activeSitesTitle") }}
            </p>
            <p class="text-sm text-blue-700 dark:text-blue-300">
              {{
                t("settings.danger.activeSitesDescription", {
                  count: selectedServerSiteCount,
                  unit: t(
                    selectedServerSiteCount === 1
                      ? "settings.danger.site"
                      : "settings.danger.sites",
                  ),
                })
              }}
            </p>
          </div>
        </div>

        <AlertDialog v-model:open="showArchiveConfirm">
          <Button
            variant="outline"
            :disabled="!selectedServerId"
            class="border-orange-500/50 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 dark:border-orange-500/30 dark:bg-orange-950/50 dark:text-orange-400 dark:hover:bg-orange-900/50 dark:hover:text-orange-300"
            @click="showArchiveConfirm = true"
          >
            {{ t("settings.danger.archiveServer") }}
          </Button>
          <AlertDialogContent class="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>{{
                t("settings.danger.archiveServer")
              }}</AlertDialogTitle>
              <AlertDialogDescription>
                {{
                  t("settings.danger.archiveConfirm", {
                    name: selectedServer?.name,
                  })
                }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div class="space-y-4 py-2">
              <p class="text-sm text-muted-foreground">
                {{ t("settings.danger.archiveImpact") }}
                <template v-if="selectedServerSiteCount > 0">
                  {{
                    t("settings.danger.archiveSitesImpact", {
                      count: selectedServerSiteCount,
                      unit: t(
                        selectedServerSiteCount === 1
                          ? "settings.danger.site"
                          : "settings.danger.sites",
                      ),
                    })
                  }}
                </template>
                {{ t("settings.danger.restoreLater") }}
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{{
                t("settings.danger.cancel")
              }}</AlertDialogCancel>
              <AlertDialogAction
                :disabled="archiveLoading"
                class="border-orange-500/50 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 dark:border-orange-500/30 dark:bg-orange-950/50 dark:text-orange-400 dark:hover:bg-orange-900/50 dark:hover:text-orange-300"
                @click="archiveServer"
              >
                <Icon
                  v-if="archiveLoading"
                  name="lucide:loader-2"
                  class="mr-2 h-4 w-4 animate-spin"
                />
                {{
                  archiveLoading
                    ? t("settings.danger.archiving")
                    : t("settings.danger.confirmArchive")
                }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>

    <!-- Archived Servers Section -->
    <div class="px-6 pt-6">
      <h3 class="mb-1 text-base font-semibold">
        {{ t("settings.danger.archivedTitle") }}
      </h3>
      <p class="mb-4 text-sm text-muted-foreground">
        {{ t("settings.danger.archivedDescription") }}
      </p>

      <div
        v-if="isLoadingArchived"
        class="flex items-center justify-center py-4"
      >
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <div v-if="archivedServers.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-2 py-2">
            <Icon name="lucide:archive" class="h-8 w-8 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">
              {{ t("settings.danger.noneArchived") }}
            </p>
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="server in archivedServers"
            :key="server.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ server.name }}</span>
                <span class="text-xs text-muted-foreground">{{
                  server.public_ipv4
                }}</span>
              </div>
              <div
                class="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span>{{ providerLabel(server.provider) }}</span>
                <span>-</span>
                <span>{{
                  t("settings.danger.archivedAt", {
                    time: formatDistanceToNow(new Date(server.archived_at), {
                      addSuffix: true,
                      locale: dateLocale,
                    }),
                  })
                }}</span>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="sm" @click="restoreServer(server)">
                <Icon name="lucide:rotate-ccw" class="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" @click="deleteServer(server)">
                <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
