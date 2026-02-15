<script setup lang="ts">
import { toast } from "vue-sonner";
import { formatDistanceToNow } from "date-fns";
import { Play, AlertCircle, AlertTriangle, Info, Loader2 } from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { PlatformUpdateDetail, ServerUpdateStatus } from "~/types";
import { platformService } from "~/services/platformService";
import { usePlatformUpdateEvents } from "~/composables/useChannelEvents";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const route = useRoute();
const { user } = useAuth();

const updateId = computed(() => route.params.id as string);
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
const update = ref<PlatformUpdateDetail | null>(null);
const isLoading = ref(true);
const runningServers = ref<Set<string>>(new Set());
const isRunningAll = ref(false);

useHead({
  title: computed(() => update.value?.title ?? "Platform Update"),
});

const severityConfig: Record<string, { variant: string; icon: typeof AlertCircle }> = {
  critical: { variant: "red", icon: AlertCircle },
  warning: { variant: "yellow", icon: AlertTriangle },
  info: { variant: "blue", icon: Info },
};

const statusVariant = (status: string) => {
  const map: Record<string, string> = {
    pending: "blank",
    running: "orange",
    completed: "green",
    failed: "red",
    skipped: "blank",
  };
  return map[status] ?? "blank";
};

const statusLabel = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const canRun = (server: ServerUpdateStatus) => {
  return server.status === "pending" || server.status === "failed";
};

const hasPendingServers = computed(() => {
  return update.value?.server_statuses.some((s) => canRun(s)) ?? false;
});

const fetchUpdate = async () => {
  try {
    const response = await platformService.getUpdate(updateId.value);
    if (response.success) {
      update.value = response.data;
    }
  } catch {
    toast.error("Failed to load platform update");
  } finally {
    isLoading.value = false;
  }
};

const runForServer = async (server: ServerUpdateStatus) => {
  runningServers.value.add(server.server_id);
  try {
    await platformService.runUpdate(updateId.value, server.server_id);
    toast.success(`Update started for ${server.server_name}`);
  } catch {
    toast.error(`Failed to start update for ${server.server_name}`);
  } finally {
    runningServers.value.delete(server.server_id);
  }
};

const runAll = async () => {
  isRunningAll.value = true;
  try {
    await platformService.runUpdateAll(updateId.value);
    toast.success("Update started for all pending servers");
  } catch {
    toast.error("Failed to start update for all servers");
  } finally {
    isRunningAll.value = false;
  }
};

const formatTime = (dateStr?: string) => {
  if (!dateStr) return "-";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "-";
  }
};

usePlatformUpdateEvents(teamId, () => {
  fetchUpdate();
});

onMounted(() => {
  fetchUpdate();
});
</script>

<template>
  <div class="mx-auto w-full max-w-5xl space-y-6">
    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="update">
      <!-- Header -->
      <div class="space-y-2">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight">{{ update.title }}</h1>
          <Badge :variant="(severityConfig[update.severity]?.variant as any) ?? 'blank'">
            <component :is="severityConfig[update.severity]?.icon" class="h-3 w-3" />
            {{ update.severity }}
          </Badge>
        </div>
        <p class="text-sm text-muted-foreground">{{ update.description }}</p>
      </div>

      <!-- Summary counts -->
      <div v-if="update.status_counts" class="flex flex-wrap gap-2">
        <Badge
          v-for="(count, status) in update.status_counts"
          :key="status"
          :variant="(statusVariant(status as string) as any)"
        >
          {{ statusLabel(status as string) }}: {{ count }}
        </Badge>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <Button
          v-if="hasPendingServers"
          :disabled="isRunningAll"
          @click="runAll"
        >
          <Loader2 v-if="isRunningAll" class="h-4 w-4 animate-spin" />
          <Play v-else class="h-4 w-4" />
          Run All
        </Button>
      </div>

      <!-- Server table -->
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Server</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="hidden md:table-cell">Error</TableHead>
              <TableHead class="hidden md:table-cell">Completed</TableHead>
              <TableHead class="w-[100px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="server in update.server_statuses"
              :key="server.id"
            >
              <TableCell class="font-medium">{{ server.server_name }}</TableCell>
              <TableCell>
                <Badge :variant="(statusVariant(server.status) as any)">
                  {{ statusLabel(server.status) }}
                </Badge>
              </TableCell>
              <TableCell class="hidden max-w-xs truncate md:table-cell">
                {{ server.error_message || "-" }}
              </TableCell>
              <TableCell class="hidden md:table-cell">
                {{ formatTime(server.completed_at) }}
              </TableCell>
              <TableCell>
                <Button
                  v-if="canRun(server)"
                  size="sm"
                  variant="outline"
                  :disabled="runningServers.has(server.server_id)"
                  @click="runForServer(server)"
                >
                  <Loader2 v-if="runningServers.has(server.server_id)" class="h-3 w-3 animate-spin" />
                  <Play v-else class="h-3 w-3" />
                  Run
                </Button>
              </TableCell>
            </TableRow>
            <TableRow v-if="update.server_statuses.length === 0">
              <TableCell :colspan="5" class="py-8 text-center text-muted-foreground">
                No servers affected by this update.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </template>

    <!-- Not found -->
    <div v-else class="py-20 text-center text-muted-foreground">
      Platform update not found.
    </div>
  </div>
</template>
