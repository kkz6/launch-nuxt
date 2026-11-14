<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  serverProviderService,
  type ContaboVPS,
} from "~/services/serverService";
import { useStableMetadataLabels } from "~/composables/useStableMetadataLabels";
import type { Server } from "~/types";

const props = defineProps<{ accountId: string; profile: string }>();
const { t } = useI18n();
const { canEdit } = useCan();
const { getServerTypeLabel } = useStableMetadataLabels();
const refreshServers = useState("serversRefreshKey", () => 0);
const open = ref(false);
const loading = ref(false);
const importing = ref(false);
const loadError = ref("");
const instances = ref<ContaboVPS[]>([]);
const page = ref(1);
const totalPages = ref(1);
const selected = ref<ContaboVPS>();
const serverType = ref("php");
const operatingSystem = ref("");
const sshPort = ref("22");
const imported = ref<Server>();
const setupOpen = ref(false);
const requestedPage = ref(1);
const serverTypes = ["php", "docker", "database", "loadbalancer"];
let listRequest = 0;

async function loadPage(nextPage: number) {
  const request = ++listRequest;
  requestedPage.value = nextPage;
  loading.value = true;
  loadError.value = "";
  try {
    const { data } = await serverProviderService.listContaboInstances(
      props.accountId,
      nextPage,
    );
    if (request !== listRequest) return;
    instances.value = data.instances;
    page.value = data.page;
    totalPages.value = data.total_pages;
  } catch (error) {
    if (request !== listRequest) return;
    const err = error as { data?: { message?: string } };
    loadError.value =
      err.data?.message || t("settings.connections.contabo.loadFailed");
  } finally {
    if (request === listRequest) loading.value = false;
  }
}

function selectInstance(instance: ContaboVPS) {
  selected.value = instance;
  serverType.value = "php";
  operatingSystem.value = "";
  sshPort.value = "22";
}

async function importInstance() {
  if (
    !selected.value ||
    !canEdit.value ||
    importing.value ||
    !operatingSystem.value
  )
    return;
  importing.value = true;
  try {
    const { data } = await serverProviderService.importContaboInstance(
      props.accountId,
      {
        instance_id: selected.value.id,
        type: serverType.value,
        operating_system: operatingSystem.value,
        port: Number(sshPort.value),
      },
    );
    refreshServers.value++;
    toast.success(t("settings.connections.contabo.imported"));
    imported.value = data;
    open.value = false;
    if (data.provision_command) setupOpen.value = true;
  } catch (error) {
    const err = error as { statusCode?: number; data?: { message?: string } };
    toast.error(
      err.data?.message || t("settings.connections.contabo.importFailed"),
    );
    if (err.statusCode === 409) {
      selected.value = undefined;
      await loadPage(page.value);
    }
  } finally {
    importing.value = false;
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    instances.value = [];
    page.value = 1;
    totalPages.value = 1;
    selected.value = undefined;
    void loadPage(1);
  } else {
    listRequest++;
    loading.value = false;
  }
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline" size="sm">
        {{ t("settings.connections.contabo.browse") }}
      </Button>
    </DialogTrigger>
    <DialogContent
      class="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
      @escape-key-down="importing && $event.preventDefault()"
      @pointer-down-outside="importing && $event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>{{ t("settings.connections.contabo.title") }}</DialogTitle>
        <DialogDescription>{{ profile }}</DialogDescription>
      </DialogHeader>

      <form v-if="selected" class="space-y-4" @submit.prevent="importInstance">
        <div>
          <p class="font-medium">{{ selected.name }}</p>
          <p class="text-sm text-muted-foreground">{{ selected.ip }}</p>
        </div>
        <p class="text-sm text-muted-foreground">
          {{ t("settings.connections.contabo.setupHelp") }}
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label :for="`contabo-type-${accountId}`">{{
              t("server.create.serverType")
            }}</Label>
            <Select v-model="serverType">
              <SelectTrigger :id="`contabo-type-${accountId}`"
                ><SelectValue
              /></SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="type in serverTypes"
                  :key="type"
                  :value="type"
                >
                  {{ getServerTypeLabel(type, type) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label :for="`contabo-os-${accountId}`">{{
              t("server.create.operatingSystem")
            }}</Label>
            <Select v-model="operatingSystem">
              <SelectTrigger :id="`contabo-os-${accountId}`">
                <SelectValue
                  :placeholder="t('settings.connections.contabo.chooseOs')"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ubuntu_24">Ubuntu 24.04 LTS</SelectItem>
                <SelectItem value="ubuntu_22">Ubuntu 22.04 LTS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label :for="`contabo-port-${accountId}`">{{
              t("settings.connections.contabo.sshPort")
            }}</Label>
            <Input
              :id="`contabo-port-${accountId}`"
              v-model="sshPort"
              type="number"
              min="1"
              max="65535"
              required
            />
          </div>
        </div>
        <div class="flex justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            :disabled="importing"
            @click="selected = undefined"
          >
            {{ t("settings.connections.contabo.back") }}
          </Button>
          <Button type="submit" :disabled="!operatingSystem || importing">
            {{
              t(
                importing
                  ? "settings.connections.contabo.importing"
                  : "settings.connections.contabo.import",
              )
            }}
          </Button>
        </div>
      </form>
      <p
        v-else-if="loading"
        role="status"
        class="text-sm text-muted-foreground"
      >
        {{ t("settings.connections.contabo.loading") }}
      </p>
      <div v-else-if="loadError" class="space-y-3">
        <p role="alert" class="text-sm text-destructive">{{ loadError }}</p>
        <Button variant="outline" size="sm" @click="loadPage(requestedPage)">
          {{ t("settings.connections.contabo.retry") }}
        </Button>
      </div>
      <template v-else>
        <p v-if="!instances.length" class="text-sm text-muted-foreground">
          {{ t("settings.connections.contabo.empty") }}
        </p>
        <ul v-else class="divide-y rounded-md border">
          <li
            v-for="instance in instances"
            :key="instance.id"
            class="flex flex-wrap items-center justify-between gap-2 p-3"
          >
            <div class="min-w-0">
              <p class="break-words font-medium">{{ instance.name }}</p>
              <p class="text-sm text-muted-foreground">
                {{
                  [
                    instance.ip,
                    instance.plan,
                    instance.region,
                    instance.os_type,
                    instance.status,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                }}
              </p>
            </div>
            <span
              v-if="instance.imported_server_id"
              class="text-sm text-muted-foreground"
            >
              {{ t("settings.connections.contabo.alreadyImported") }}
            </span>
            <Button
              v-else-if="canEdit && instance.can_import"
              variant="outline"
              size="sm"
              @click="selectInstance(instance)"
            >
              {{ t("settings.connections.contabo.import") }}
            </Button>
            <span v-else-if="canEdit" class="text-sm text-muted-foreground">
              {{ t("settings.connections.contabo.ineligible") }}
            </span>
          </li>
        </ul>
        <div
          v-if="page > 1 || totalPages > 1"
          class="flex justify-between gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            :disabled="page <= 1"
            @click="loadPage(page - 1)"
          >
            {{ t("settings.connections.contabo.previous") }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="page >= totalPages"
            @click="loadPage(page + 1)"
          >
            {{ t("settings.connections.contabo.next") }}
          </Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
  <ServerProvisionCommandDialog
    v-if="imported"
    v-model:open="setupOpen"
    :server-id="imported.id"
    :provision-command="imported.provision_command ?? null"
    @connected="refreshServers++"
  />
</template>
