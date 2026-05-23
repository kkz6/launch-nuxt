<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  dockerService,
  type DockerHostContainer,
} from "~/services/dockerService";

interface Props {
  serverId: string;
}
const props = defineProps<Props>();

const rows = ref<DockerHostContainer[]>([]);
const isLoading = ref(true);
const refreshing = ref(false);

// Launch-managed containers (Traefik etc.) are hidden by default — the
// Containers tab is meant for user workloads, not infrastructure.
// Mirrors dokploy's behaviour. The toggle reveals them for admins
// debugging the control plane.
const showSystem = ref(false);

const visibleRows = computed(() =>
  showSystem.value ? rows.value : rows.value.filter((r) => !r.system),
);

const systemCount = computed(() => rows.value.filter((r) => r.system).length);

const fetchRows = async () => {
  refreshing.value = true;
  try {
    const res = await dockerService.host.containers(props.serverId);
    rows.value = res.data;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to list containers");
  } finally {
    isLoading.value = false;
    refreshing.value = false;
  }
};

const stateBadge = (state: string): string => {
  if (state.toLowerCase() === "running") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  }
  if (state.toLowerCase() === "exited") {
    return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
  }
  return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
};

// Status detail dialog state. Clicking the state badge opens it
// against the row's container — mirrors how the PHP server's
// Services tab clickable status badge works (see
// ServiceStatusDialog.vue for the original pattern).
const statusDialogOpen = ref(false);
const inspectTarget = ref<DockerHostContainer | null>(null);
const openStatus = (c: DockerHostContainer) => {
  inspectTarget.value = c;
  statusDialogOpen.value = true;
};

onMounted(fetchRows);
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-semibold">Containers</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Workloads running on this docker host. Launch's own services
          (Traefik, etc.) are hidden by default.
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
      <Icon name="lucide:container" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No containers</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        {{
          systemCount > 0 && !showSystem
            ? `Only system containers are running. Toggle "Show system" above to see them, or deploy an application to populate this view.`
            : "Once you deploy an application or compose stack, the resulting containers will appear here."
        }}
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Image</th>
            <th class="px-4 py-3">State</th>
            <th class="px-4 py-3">Ports</th>
            <th class="px-4 py-3">Created</th>
            <!-- Right-aligned action column for the inspect button. -->
            <th class="w-px px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in visibleRows" :key="c.ID" class="border-t">
            <td class="px-4 py-3 align-top font-mono text-xs">
              <div class="flex items-center gap-2">
                <span>{{ c.Names }}</span>
                <span
                  v-if="c.system"
                  class="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:text-zinc-300"
                  title="Installed and managed by Launch"
                >
                  system
                </span>
              </div>
              <p class="text-[10px] text-muted-foreground">{{ c.ID }}</p>
            </td>
            <td class="px-4 py-3 align-top font-mono text-xs">{{ c.Image }}</td>
            <td class="px-4 py-3 align-top">
              <!--
                Passive badge — the uptime / status detail
                (`Up 21 hours`, `Exited (0) 2 minutes ago`, etc.)
                lives in the native title tooltip. The full
                docker-inspect dialog opens from the Actions column
                so the badge stays a status indicator, not an
                action surface.
              -->
              <TooltipProvider :delay-duration="150">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span
                      class="inline-flex cursor-default rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                      :class="stateBadge(c.State)"
                    >
                      {{ c.State }}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" class="max-w-xs text-xs">
                    {{ c.Status || c.State }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </td>
            <td class="px-4 py-3 align-top font-mono text-xs text-muted-foreground">
              <template v-if="c.Ports">
                <!--
                  docker ps returns ports as a single comma-separated
                  blob, e.g. "0.0.0.0:80->80/tcp, [::]:80->80/tcp".
                  Split on commas so each binding sits on its own line —
                  much easier to scan than one wrapped paragraph.
                -->
                <div
                  v-for="(p, i) in c.Ports.split(',').map((s) => s.trim()).filter(Boolean)"
                  :key="i"
                  class="whitespace-nowrap"
                >
                  {{ p }}
                </div>
              </template>
              <template v-else>—</template>
            </td>
            <td class="px-4 py-3 align-top text-muted-foreground">
              {{ c.CreatedAt }}
            </td>
            <!--
              Inspect action. Icon-only to keep the row compact;
              the native title tooltip plus the icon (info-circle)
              is enough affordance for "click here for more".
              Dropdown menu would be the right pattern once a
              second action lands (View logs, Restart, etc.) —
              defer until then.
            -->
            <td class="px-4 py-3 align-top text-right">
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                title="Inspect container"
                @click="openStatus(c)"
              >
                <Icon name="lucide:info" class="h-4 w-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ServerDockerContainerStatusDialog
      v-model:open="statusDialogOpen"
      :server-id="props.serverId"
      :container="inspectTarget"
    />
  </div>
</template>
