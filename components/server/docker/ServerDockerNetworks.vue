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

// Hide docker's built-ins (bridge / host / none) and the
// launch-network overlay by default. Anyone debugging plumbing flips
// the toggle to see them.
const showSystem = ref(false);
const visibleRows = computed(() =>
  showSystem.value ? rows.value : rows.value.filter((r) => !r.system),
);
const systemCount = computed(() => rows.value.filter((r) => r.system).length);

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
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-semibold">Networks</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          User-managed docker networks. Docker's built-ins and the
          <code>launch-network</code> overlay are hidden by default.
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
      <Icon name="lucide:network" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No user networks</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        {{
          systemCount > 0
            ? `Only system networks exist. Toggle "Show system" above to see them.`
            : "User-managed networks will appear here once you create them."
        }}
      </p>
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
          <tr v-for="n in visibleRows" :key="n.ID" class="border-t">
            <td class="px-4 py-3 font-mono text-xs">
              <div class="flex items-center gap-2">
                <span>{{ n.Name }}</span>
                <span
                  v-if="n.system"
                  class="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:text-zinc-300"
                >
                  system
                </span>
              </div>
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
