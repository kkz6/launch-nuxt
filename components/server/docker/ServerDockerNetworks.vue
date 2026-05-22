<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerHostNetwork,
} from "~/services/dockerService";

interface Props {
  serverId: string;
}
const props = defineProps<Props>();

const rows = ref<DockerHostNetwork[]>([]);
const isLoading = ref(true);
const refreshing = ref(false);

const fetchRows = async () => {
  refreshing.value = true;
  try {
    const res = await dockerService.host.networks(props.serverId);
    rows.value = res.data;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to list networks");
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
        <h2 class="text-2xl font-semibold">Networks</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Docker networks on this host.
          <code>launch-network</code> is the overlay we run apps on so
          Traefik can route to them by name.
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

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Driver</th>
            <th class="px-4 py-3">Scope</th>
            <th class="px-4 py-3">ID</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in rows" :key="n.ID" class="border-t">
            <td class="px-4 py-3 font-mono text-xs">
              {{ n.Name }}
              <span
                v-if="n.Name === 'launch-network'"
                class="ml-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                managed
              </span>
            </td>
            <td class="px-4 py-3 text-muted-foreground">{{ n.Driver }}</td>
            <td class="px-4 py-3 text-muted-foreground">{{ n.Scope }}</td>
            <td class="px-4 py-3 font-mono text-[10px] text-muted-foreground">
              {{ n.ID.slice(0, 12) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
