<script setup lang="ts">
import { toast } from "vue-sonner";
import { formatDistanceToNow } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import {
  Play,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-vue-next";
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
const { t, te, locale } = useI18n();

const updateId = computed(() => route.params.id as string);
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
const update = ref<PlatformUpdateDetail | null>(null);
const isLoading = ref(true);
const runningServers = ref<Set<string>>(new Set());
const isRunningAll = ref(false);

const localizedUpdateText = (
  platformUpdate: PlatformUpdateDetail,
  field: "title" | "description",
) => {
  const key = `common.platformUpdate.updates.${platformUpdate.key}.${field}`;
  const translated = t(key);
  return translated === key ? platformUpdate[field] : translated;
};

const localizedUpdateTitle = (platformUpdate: PlatformUpdateDetail) =>
  localizedUpdateText(platformUpdate, "title");

useHead({
  title: computed(
    () =>
      (update.value ? localizedUpdateTitle(update.value) : null) ??
      t("public.platformUpdate.pageTitle"),
  ),
});

const severityConfig: Record<
  string,
  { variant: string; icon: typeof AlertCircle }
> = {
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
  const key = `public.platformUpdate.status.${status}`;
  return te(key) ? t(key) : status;
};

const severityLabel = (severity: string) => {
  const key = `public.platformUpdate.severity.${severity}`;
  return te(key) ? t(key) : severity;
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
    toast.error(t("public.platformUpdate.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const runForServer = async (server: ServerUpdateStatus) => {
  runningServers.value.add(server.server_id);
  try {
    await platformService.runUpdate(updateId.value, server.server_id);
    toast.success(
      t("public.platformUpdate.startedFor", { server: server.server_name }),
    );
  } catch {
    toast.error(
      t("public.platformUpdate.startFailedFor", { server: server.server_name }),
    );
  } finally {
    runningServers.value.delete(server.server_id);
  }
};

const runAll = async () => {
  isRunningAll.value = true;
  try {
    await platformService.runUpdateAll(updateId.value);
    toast.success(t("public.platformUpdate.startedAll"));
  } catch {
    toast.error(t("public.platformUpdate.startAllFailed"));
  } finally {
    isRunningAll.value = false;
  }
};

const formatTime = (dateStr?: string) => {
  if (!dateStr) return "-";
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: locale.value === "ja" ? ja : enUS,
    });
  } catch {
    return "-";
  }
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "en-US").format(
    value,
  );

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
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ localizedUpdateTitle(update) }}
          </h1>
          <Badge
            :variant="
              (severityConfig[update.severity]?.variant as any) ?? 'blank'
            "
          >
            <component
              :is="severityConfig[update.severity]?.icon"
              class="h-3 w-3"
            />
            {{ severityLabel(update.severity) }}
          </Badge>
        </div>
        <p class="whitespace-pre-line text-sm text-muted-foreground">
          {{ localizedUpdateText(update, "description") }}
        </p>
      </div>

      <!-- Summary counts -->
      <div v-if="update.status_counts" class="flex flex-wrap gap-2">
        <Badge
          v-for="(count, status) in update.status_counts"
          :key="status"
          :variant="statusVariant(status as string) as any"
        >
          {{ statusLabel(status as string) }}: {{ formatNumber(count) }}
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
          {{ t("public.platformUpdate.runAll") }}
        </Button>
      </div>

      <!-- Server table -->
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t("public.platformUpdate.server") }}</TableHead>
              <TableHead>{{
                t("public.platformUpdate.statusHeading")
              }}</TableHead>
              <TableHead class="hidden md:table-cell">{{
                t("public.platformUpdate.error")
              }}</TableHead>
              <TableHead class="hidden md:table-cell">{{
                t("public.platformUpdate.completed")
              }}</TableHead>
              <TableHead class="w-[100px]">{{
                t("public.platformUpdate.action")
              }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="server in update.server_statuses" :key="server.id">
              <TableCell class="font-medium">{{
                server.server_name
              }}</TableCell>
              <TableCell>
                <Badge :variant="statusVariant(server.status) as any">
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
                  <Loader2
                    v-if="runningServers.has(server.server_id)"
                    class="h-3 w-3 animate-spin"
                  />
                  <Play v-else class="h-3 w-3" />
                  {{ t("public.platformUpdate.run") }}
                </Button>
              </TableCell>
            </TableRow>
            <TableRow v-if="update.server_statuses.length === 0">
              <TableCell
                :colspan="5"
                class="py-8 text-center text-muted-foreground"
              >
                {{ t("public.platformUpdate.noServers") }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </template>

    <!-- Not found -->
    <div v-else class="py-20 text-center text-muted-foreground">
      {{ t("public.platformUpdate.notFound") }}
    </div>
  </div>
</template>
