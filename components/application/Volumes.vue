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

// Volumes list lives in this component; the add-form moved to
// ApplicationCreateVolume (dialog), same pattern Redirects and
// Schedules use. Keeps this file focused on display + delete.
const volumes = ref<DockerVolume[]>([]);
const isLoading = ref(true);

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

const onCreated = () => {
  fetchVolumes();
};

const removeVolume = async (v: DockerVolume) => {
  if (!confirmationDialog.value) return;
  const kind =
    v.type === "file"
      ? "file mount"
      : v.type === "bind"
        ? "bind mount"
        : "volume";
  const result = await confirmationDialog.value.show({
    title: `Remove ${kind}`,
    description: `Remove "${v.name}" from this application? ${
      v.type === "volume"
        ? "The underlying docker named volume is NOT deleted."
        : v.type === "bind"
          ? "The host directory is left in place."
          : "The on-host config file is left in place."
    }`,
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
    toast.success("Mount removed");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to remove mount");
  }
};

// Normalise the legacy "named" type to "volume" for display; the
// backend coerces on create but historic rows still carry the old
// string.
const typeLabel = (t: DockerVolumeType): string => {
  switch (t) {
    case "bind":
      return "bind";
    case "file":
      return "file";
    case "volume":
    case "named":
    default:
      return "volume";
  }
};

const typeBadgeClass = (t: DockerVolumeType): string => {
  switch (t) {
    case "bind":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "file":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "volume":
    case "named":
    default:
      return "bg-violet-500/15 text-violet-700 dark:text-violet-400";
  }
};

// Source / target column resolver — what to show in the "Source"
// column varies by mount kind:
//   - bind:   host_path
//   - volume: name
//   - file:   file_path (the on-host filename)
const sourceFor = (v: DockerVolume): string => {
  if (v.type === "bind") return v.host_path || "—";
  if (v.type === "file") return v.file_path || v.name;
  return v.name;
};

onMounted(fetchVolumes);
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Volumes / Mounts</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Three flavours: <span class="font-medium">bind</span> maps a
          host path, <span class="font-medium">volume</span> uses a
          docker named volume that survives container replacement,
          <span class="font-medium">file</span> writes a config file on
          the host and bind-mounts it.
        </p>
      </div>
      <ApplicationCreateVolume
        v-if="volumes.length > 0"
        :application="application"
        @created="onCreated"
      />
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <!--
      Empty state. The Add Mount button slot lives inline here (not
      via SharedDataTable's #empty since the table isn't rendered when
      the list is empty) so users always see a primary CTA when there
      are no mounts yet.
    -->
    <div
      v-else-if="volumes.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:hard-drive" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No mounts yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Attach a bind mount, named volume, or file mount to persist
        state or push config into the container.
      </p>
      <div class="mt-6">
        <ApplicationCreateVolume
          :application="application"
          @created="onCreated"
        />
      </div>
    </div>

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead
          class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"
        >
          <tr>
            <th class="px-4 py-3">Type</th>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Source</th>
            <th class="px-4 py-3">Mount path</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in volumes" :key="v.id" class="border-t">
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="typeBadgeClass(v.type)"
              >
                {{ typeLabel(v.type) }}
              </span>
            </td>
            <td class="px-4 py-3 font-medium">{{ v.name }}</td>
            <td class="px-4 py-3 font-mono text-xs">{{ sourceFor(v) }}</td>
            <td class="px-4 py-3 font-mono text-xs">{{ v.mount_path }}</td>
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
      <Icon
        name="lucide:info"
        class="-mt-0.5 mr-1 inline-block h-3 w-3"
      />
      Mount changes only apply on the next deploy — running containers
      keep their existing mounts.
    </p>
  </div>
</template>
