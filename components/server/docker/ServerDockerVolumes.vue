<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerHostVolume,
} from "~/services/dockerService";

interface Props {
  serverId: string;
}
const props = defineProps<Props>();

const rows = ref<DockerHostVolume[]>([]);
const isLoading = ref(true);
const refreshing = ref(false);

// Hide Launch-managed volumes (currently none — kept for future
// control-plane state). Matches the Containers + Networks tabs so the
// UX is consistent across the host-inspect family.
const showSystem = ref(false);
const visibleRows = computed(() =>
  showSystem.value ? rows.value : rows.value.filter((r) => !r.system),
);
const systemCount = computed(() => rows.value.filter((r) => r.system).length);

const fetchRows = async () => {
  refreshing.value = true;
  try {
    const res = await dockerService.host.volumes(props.serverId);
    rows.value = res.data;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to list volumes");
  } finally {
    isLoading.value = false;
    refreshing.value = false;
  }
};

onMounted(fetchRows);
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-semibold">Volumes</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Docker volumes on this host. System-managed volumes are
          hidden by default.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <label
          v-if="systemCount > 0"
          class="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Switch v-model="showSystem" />
          Show system ({{ systemCount }})
        </label>
        <Button variant="outline" :disabled="refreshing" @click="fetchRows">
          <Icon
            :name="refreshing ? 'lucide:loader-2' : 'lucide:refresh-cw'"
            :class="['mr-2 h-4 w-4', refreshing && 'animate-spin']"
          />
          Refresh
        </Button>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="visibleRows.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:hard-drive" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No docker volumes</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Volumes attached to deployed applications show up here.
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Driver</th>
            <th class="px-4 py-3">Scope</th>
            <th class="px-4 py-3">Mountpoint</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in visibleRows" :key="v.Name" class="border-t">
            <td class="px-4 py-3 align-top font-mono text-xs">
              <div class="flex items-center gap-2">
                <span>{{ v.Name }}</span>
                <span
                  v-if="v.system"
                  class="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:text-zinc-300"
                >
                  system
                </span>
              </div>
            </td>
            <td class="px-4 py-3 align-top text-muted-foreground">{{ v.Driver }}</td>
            <td class="px-4 py-3 align-top text-muted-foreground">{{ v.Scope }}</td>
            <td class="px-4 py-3 align-top font-mono text-xs text-muted-foreground">
              {{ v.Mountpoint }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
