<script setup lang="ts">
import { Activity, Loader2 } from "lucide-vue-next";
import { useDeploymentEvents } from "~/composables/useChannelEvents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";

interface ActiveAction {
  id: string;
  kind: string;
  status: string;
  label: string;
  server_id: string;
  project_id?: string;
  target_type: "site" | "application" | "compose";
  target_id: string;
  task_id?: string;
  started_at?: string;
  created_at: string;
}

const { user } = useAuth();
const { get } = useApi();
const router = useRouter();
const actions = ref<ActiveAction[]>([]);
const isLoading = ref(false);
const logsOpen = ref(false);
const selected = ref<ActiveAction | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

const teamId = computed(() => String(user.value?.current_team_id || ""));
const fetchActions = async () => {
  if (!teamId.value) return;
  isLoading.value = true;
  try {
    const response = await get<{ data: ActiveAction[] }>("/actions/active");
    actions.value = response.data || [];
  } finally {
    isLoading.value = false;
  }
};

useDeploymentEvents(teamId, () => fetchActions());
onMounted(() => { fetchActions(); timer = setInterval(fetchActions, 10_000); });
onUnmounted(() => { if (timer) clearInterval(timer); });

const elapsed = (action: ActiveAction) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(action.started_at || action.created_at).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`;
};
const openAction = (action: ActiveAction) => {
  selected.value = action;
  if (action.task_id) { logsOpen.value = true; return; }
  const base = `/servers/${action.server_id}`;
  const target = action.target_type === "site"
    ? `${base}/sites/${action.target_id}?tab=deployments`
    : `${base}/projects/${action.project_id}/${action.target_type === "application" ? "applications" : "composes"}/${action.target_id}?tab=deployments`;
  router.push(target);
};
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button class="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Active actions">
        <Activity class="h-4 w-4" :class="actions.length && 'text-primary'" />
        <span v-if="actions.length" class="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{{ actions.length }}</span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-80 p-1">
      <DropdownMenuLabel class="flex items-center gap-2"><Loader2 v-if="isLoading" class="h-3.5 w-3.5 animate-spin" /> Active actions</DropdownMenuLabel>
      <p v-if="!actions.length && !isLoading" class="px-2 py-5 text-center text-sm text-muted-foreground">No actions are running.</p>
      <DropdownMenuItem v-for="action in actions" :key="action.id" class="cursor-pointer items-start gap-3 rounded-md px-2 py-2" @click="openAction(action)">
        <Loader2 class="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
        <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium">{{ action.label }}</span><span class="block text-xs text-muted-foreground">{{ action.kind }} · {{ action.status }} · {{ elapsed(action) }}</span></span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <Sheet v-model:open="logsOpen">
    <SheetContent class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-[calc(100vh-5rem)] w-full rounded-lg border sm:max-w-4xl flex flex-col overflow-hidden outline-none">
      <SheetHeader><SheetTitle>{{ selected?.label }} logs</SheetTitle><SheetDescription>Live deployment output</SheetDescription></SheetHeader>
      <div class="mt-4 min-h-0 flex-1"><ServerLogViewer v-if="logsOpen && selected?.task_id" :server-id="selected.server_id" entity="task" :entity-id="selected.task_id" :no-timestamp="true" hide-options container-class-name="h-full rounded-b-lg" /></div>
    </SheetContent>
  </Sheet>
</template>
