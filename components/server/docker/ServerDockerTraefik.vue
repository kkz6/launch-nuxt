<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerTraefikSnapshot,
} from "~/services/dockerService";

interface Props {
  serverId: string;
}
const props = defineProps<Props>();

const snap = ref<DockerTraefikSnapshot | null>(null);
const isLoading = ref(true);
const refreshing = ref(false);

const fetchSnap = async () => {
  refreshing.value = true;
  try {
    const res = await dockerService.host.traefik(props.serverId);
    snap.value = res.data;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to load Traefik config");
  } finally {
    isLoading.value = false;
    refreshing.value = false;
  }
};

const dynamicEntries = computed(() => {
  if (!snap.value) return [];
  return Object.entries(snap.value.dynamic_files).sort(([a], [b]) =>
    a.localeCompare(b),
  );
});

onMounted(fetchSnap);
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold">Traefik</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Static + dynamic config Traefik is reading. The dynamic
          directory is auto-updated when you add or change application
          domains.
        </p>
      </div>
      <Button variant="outline" :disabled="refreshing" @click="fetchSnap">
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

    <div v-else-if="snap" class="space-y-6">
      <section class="rounded-lg border bg-card p-6">
        <h3 class="text-lg font-semibold">Static config</h3>
        <p class="mt-1 text-xs text-muted-foreground">
          <code>/etc/launch/traefik/traefik.yml</code>
        </p>
        <pre
          class="mt-3 max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs"
          >{{ snap.static_config || "(empty — Traefik not provisioned)" }}</pre
        >
      </section>

      <section class="rounded-lg border bg-card p-6">
        <h3 class="text-lg font-semibold">Dynamic config</h3>
        <p class="mt-1 text-xs text-muted-foreground">
          <code>/etc/launch/traefik/dynamic/</code> — one file per app
          with domains attached.
        </p>
        <div
          v-if="dynamicEntries.length === 0"
          class="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
        >
          No dynamic files yet — add a domain to an application to see
          its router config here.
        </div>
        <div v-else class="mt-4 space-y-4">
          <details
            v-for="[name, contents] in dynamicEntries"
            :key="name"
            class="rounded-md border"
          >
            <summary
              class="cursor-pointer px-4 py-2 font-mono text-xs hover:bg-muted/30"
            >
              {{ name }}
            </summary>
            <pre
              class="max-h-72 overflow-auto rounded-b-md bg-muted/20 p-3 font-mono text-xs"
              >{{ contents }}</pre
            >
          </details>
        </div>
      </section>
    </div>
  </div>
</template>
