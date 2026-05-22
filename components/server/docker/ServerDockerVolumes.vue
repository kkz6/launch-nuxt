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
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold">Volumes</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Docker volumes on this host. Read-only view of
          <code>docker volume ls</code>.
        </p>
      </div>
      <Button variant="outline" :disabled="refreshing" @click="fetchRows">
        <Icon
          :name="refreshing ? 'lucide:loader-2' : 'lucide:refresh-cw'"
          :class="['mr-2 h-4 w-4', refreshing && 'animate-spin']"
        />
        Refresh
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="rows.length === 0"
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
          <tr v-for="v in rows" :key="v.Name" class="border-t">
            <td class="px-4 py-3 font-mono text-xs">{{ v.Name }}</td>
            <td class="px-4 py-3 text-muted-foreground">{{ v.Driver }}</td>
            <td class="px-4 py-3 text-muted-foreground">{{ v.Scope }}</td>
            <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
              {{ v.Mountpoint }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
