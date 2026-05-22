<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
  type DockerVolume,
  type DockerVolumeType,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();

const volumes = ref<DockerVolume[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const showAddForm = ref(false);

const form = reactive({
  type: "named" as DockerVolumeType,
  name: "",
  mount_path: "",
  host_path: "",
});

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const fetchVolumes = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.applications.listVolumes(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    volumes.value = res.data;
  } catch {
    toast.error("Failed to load volumes");
  } finally {
    isLoading.value = false;
  }
};

const resetForm = () => {
  form.type = "named";
  form.name = "";
  form.mount_path = "";
  form.host_path = "";
};

const submitAdd = async () => {
  if (!form.name.trim() || !form.mount_path.trim()) {
    toast.error("Name and mount path are required");
    return;
  }
  if (form.type === "bind" && !form.host_path.trim()) {
    toast.error("Bind mounts need a host path");
    return;
  }
  isSaving.value = true;
  try {
    const res = await dockerService.applications.createVolume(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      {
        name: form.name.trim(),
        mount_path: form.mount_path.trim(),
        type: form.type,
        ...(form.type === "bind" ? { host_path: form.host_path.trim() } : {}),
      },
    );
    volumes.value = [...volumes.value, res.data].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    resetForm();
    showAddForm.value = false;
    toast.success("Volume added");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to add volume");
  } finally {
    isSaving.value = false;
  }
};

const removeVolume = async (v: DockerVolume) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Remove Volume",
    description: `Remove ${v.name} from this application? Data on the underlying volume is NOT deleted.`,
    confirmText: "Remove",
    cancelText: "Cancel",
    destructive: true,
  });
  if (!result.ok) return;
  try {
    await dockerService.applications.deleteVolume(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      v.id,
    );
    volumes.value = volumes.value.filter((x) => x.id !== v.id);
    toast.success("Volume removed");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to remove volume");
  }
};

onMounted(fetchVolumes);
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Volumes</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Mounts attached to the container at deploy time. Named volumes
          survive container replacement; bind mounts map a host path
          straight into the container.
        </p>
      </div>
      <Button @click="showAddForm = !showAddForm">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Add Volume
      </Button>
    </div>

    <div
      v-if="showAddForm"
      class="space-y-3 rounded-lg border bg-card p-4"
    >
      <div class="space-y-2">
        <Label>Type</Label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="t in [
              { value: 'named' as const, label: 'Named volume', icon: 'lucide:database' },
              { value: 'bind' as const, label: 'Bind mount', icon: 'lucide:link-2' },
            ]"
            :key="t.value"
            type="button"
            class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition"
            :class="
              form.type === t.value
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-input text-muted-foreground hover:border-foreground/40'
            "
            @click="form.type = t.value"
          >
            <Icon :name="t.icon" class="h-4 w-4" />
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="space-y-1">
          <Label for="vol-name">Name</Label>
          <Input
            id="vol-name"
            v-model="form.name"
            placeholder="data"
            autocomplete="off"
          />
        </div>
        <div class="space-y-1">
          <Label for="vol-mount">Mount path</Label>
          <Input
            id="vol-mount"
            v-model="form.mount_path"
            placeholder="/var/lib/app/data"
            autocomplete="off"
          />
        </div>
      </div>

      <div v-if="form.type === 'bind'" class="space-y-1">
        <Label for="vol-host">Host path</Label>
        <Input
          id="vol-host"
          v-model="form.host_path"
          placeholder="/opt/launch/data"
          autocomplete="off"
        />
        <p class="text-xs text-muted-foreground">
          Absolute path on the docker server. Must exist and be readable
          by the container's user.
        </p>
      </div>

      <div class="flex justify-end gap-2">
        <Button
          variant="outline"
          :disabled="isSaving"
          @click="showAddForm = false"
        >
          Cancel
        </Button>
        <Button :disabled="isSaving" @click="submitAdd">
          <Icon
            v-if="isSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Add Volume
        </Button>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="volumes.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:hard-drive" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No volumes yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Attach a named volume for persistent state, or bind a host
        directory into the container.
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-3">Type</th>
            <th class="px-4 py-3">Name / Host</th>
            <th class="px-4 py-3">Mount path</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in volumes" :key="v.id" class="border-t">
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="
                  v.type === 'bind'
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                    : 'bg-violet-500/15 text-violet-700 dark:text-violet-400'
                "
              >
                {{ v.type }}
              </span>
            </td>
            <td class="px-4 py-3 font-mono text-xs">
              {{ v.type === "bind" ? v.host_path || v.name : v.name }}
            </td>
            <td class="px-4 py-3 font-mono text-xs">
              {{ v.mount_path }}
            </td>
            <td class="px-4 py-3 text-right">
              <Button variant="ghost" size="icon" @click="removeVolume(v)">
                <Icon name="lucide:trash-2" class="h-4 w-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-muted-foreground">
      <Icon name="lucide:info" class="-mt-0.5 mr-1 inline-block h-3 w-3" />
      Volume changes only apply on the next deploy — running containers
      keep their existing mounts.
    </p>
  </div>
</template>
