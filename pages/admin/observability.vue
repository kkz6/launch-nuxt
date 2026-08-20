<script setup lang="ts">
import { toast } from "vue-sonner";
import type { ObservabilitySnapshot } from "~/types";
import { adminService } from "~/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

const { locale, t } = useI18n();

const applyBreadcrumb = (): void => {
  setBreadcrumbs([
    { label: t("admin.common.admin"), to: "/admin/overview" },
    { label: t("admin.common.observability") },
  ]);
};
applyBreadcrumb();
watch(locale, applyBreadcrumb);

useHead({
  title: () => t("admin.observability.pageTitle"),
});

const snapshot = ref<ObservabilitySnapshot | null>(null);
const isLoading = ref(true);
const autoRefresh = ref(true);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const fetchSnapshot = async () => {
  try {
    const response = await adminService.observabilitySnapshot();
    snapshot.value = response.data;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("admin.observability.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const startAutoRefresh = () => {
  stopAutoRefresh();
  refreshTimer = setInterval(fetchSnapshot, 5000);
};

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

watch(autoRefresh, (enabled) => {
  if (enabled) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

onMounted(() => {
  fetchSnapshot();
  startAutoRefresh();
});

onUnmounted(() => stopAutoRefresh());

const poolUsagePercent = computed(() => {
  if (!snapshot.value?.db_pool) return 0;
  const { in_use, max_open } = snapshot.value.db_pool;
  if (max_open === 0) return 0;
  return Math.round((in_use / max_open) * 100);
});

const poolStatus = computed<"destructive" | "warning" | "default">(() => {
  const pct = poolUsagePercent.value;
  if (pct >= 90) return "destructive";
  if (pct >= 70) return "warning";
  return "default";
});

const memoryPercent = computed(() => {
  if (!snapshot.value?.runtime) return 0;
  const { heap_alloc_mb, sys_mem_mb } = snapshot.value.runtime;
  if (sys_mem_mb === 0) return 0;
  return Math.round((heap_alloc_mb / sys_mem_mb) * 100);
});

const formatDuration = (ms: number): string => {
  if (ms < 1) return `${formatDecimal(ms * 1000, 0)}µs`;
  if (ms < 1000) return `${formatDecimal(ms, 1)}ms`;
  return `${formatDecimal(ms / 1000, 2)}s`;
};

const formatTimestamp = (ts: string): string => {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString(locale.value);
  } catch {
    return ts;
  }
};

const formatNumber = (value: number): string =>
  value.toLocaleString(locale.value);

function formatDecimal(value: number, digits: number): string {
  return value.toLocaleString(locale.value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
</script>

<template>
  <div class="space-y-6 pb-10">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold">
          {{ t("admin.observability.title") }}
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ t("admin.observability.description") }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            v-model="autoRefresh"
            type="checkbox"
            class="rounded border-input"
          />
          {{ t("admin.observability.autoRefresh", { seconds: 5 }) }}
        </label>
        <button
          class="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
          @click="fetchSnapshot"
        >
          {{ t("admin.observability.refresh") }}
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else-if="snapshot">
      <!-- Top stat cards -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ t("admin.observability.uptime") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-bold">{{ snapshot.runtime.uptime }}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ t("admin.observability.goroutines") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-bold">
              {{ formatNumber(snapshot.runtime.goroutines) }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ t("admin.observability.heapAlloc") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-bold">
              {{ formatDecimal(snapshot.runtime.heap_alloc_mb, 1) }} MB
            </p>
            <Progress :model-value="memoryPercent" class="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ t("admin.observability.gcPauses") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-bold">
              {{ formatDecimal(snapshot.runtime.last_gc_pause_ms, 2) }}ms
            </p>
            <p class="text-xs text-muted-foreground">
              {{
                t("admin.observability.cycles", {
                  count: formatNumber(snapshot.runtime.num_gc),
                })
              }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ t("admin.observability.avgQuery") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-bold">
              {{ formatDuration(snapshot.queries.avg_ms) }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{
                t("admin.observability.total", {
                  count: formatNumber(snapshot.queries.total),
                })
              }}
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- DB Pool -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle class="text-base">
              {{ t("admin.observability.dbConnectionPool") }}
            </CardTitle>
            <Badge :variant="poolStatus">
              {{
                t("admin.observability.percentUsed", {
                  percent: formatNumber(poolUsagePercent),
                })
              }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div
            v-if="snapshot.db_pool"
            class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
          >
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.maxOpen") }}
              </p>
              <p class="text-lg font-semibold">
                {{ formatNumber(snapshot.db_pool.max_open) }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.open") }}
              </p>
              <p class="text-lg font-semibold">
                {{ formatNumber(snapshot.db_pool.open) }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.inUse") }}
              </p>
              <p class="text-lg font-semibold">
                {{ formatNumber(snapshot.db_pool.in_use) }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.idle") }}
              </p>
              <p class="text-lg font-semibold">
                {{ formatNumber(snapshot.db_pool.idle) }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.waitCount") }}
              </p>
              <p class="text-lg font-semibold">
                {{ formatNumber(snapshot.db_pool.wait_count) }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.waitDuration") }}
              </p>
              <p class="text-lg font-semibold">
                {{ snapshot.db_pool.wait_duration }}
              </p>
            </div>
          </div>
          <Progress :model-value="poolUsagePercent" class="mt-4 h-2" />
        </CardContent>
      </Card>

      <!-- Runtime Details -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">
            {{ t("admin.observability.goRuntime") }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.heapInUse") }}
              </p>
              <p class="text-lg font-semibold">
                {{ formatDecimal(snapshot.runtime.heap_inuse_mb, 1) }} MB
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.heapObjects") }}
              </p>
              <p class="text-lg font-semibold">
                {{ formatDecimal(snapshot.runtime.heap_objects_k, 1) }}K
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.stackInUse") }}
              </p>
              <p class="text-lg font-semibold">
                {{ formatDecimal(snapshot.runtime.stack_inuse_mb, 1) }} MB
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.systemMemory") }}
              </p>
              <p class="text-lg font-semibold">
                {{ formatDecimal(snapshot.runtime.sys_mem_mb, 1) }} MB
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.gcCpu") }}
              </p>
              <p class="text-lg font-semibold">
                {{ formatDecimal(snapshot.runtime.gc_cpu_percent, 3) }}%
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">
                {{ t("admin.observability.cpus") }}
              </p>
              <p class="text-lg font-semibold">
                {{ formatNumber(snapshot.runtime.num_cpu) }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Query tabs -->
      <Tabs default-value="recent" class="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">
            {{ t("admin.observability.recentQueries") }}
            <Badge variant="secondary" class="ml-2">
              {{ formatNumber(snapshot.queries.total) }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="slow">
            {{ t("admin.observability.slowQueries") }}
            <Badge
              :variant="
                snapshot.queries.slow_count > 0 ? 'destructive' : 'secondary'
              "
              class="ml-2"
            >
              {{ formatNumber(snapshot.queries.slow_count) }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="n1">
            {{ t("admin.observability.n1Detected") }}
            <Badge
              :variant="
                snapshot.queries.n1_count > 0 ? 'destructive' : 'secondary'
              "
              class="ml-2"
            >
              {{ formatNumber(snapshot.queries.n1_count) }}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <!-- Recent queries -->
        <TabsContent value="recent">
          <Card>
            <CardContent class="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[50%]">SQL</TableHead>
                    <TableHead>{{
                      t("admin.observability.duration")
                    }}</TableHead>
                    <TableHead>{{ t("admin.observability.rows") }}</TableHead>
                    <TableHead>{{ t("admin.observability.caller") }}</TableHead>
                    <TableHead>{{ t("admin.observability.time") }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="(q, i) in snapshot.queries.recent"
                    :key="i"
                    :class="{ 'bg-destructive/5': q.slow }"
                  >
                    <TableCell class="max-w-md truncate font-mono text-xs">
                      <Badge v-if="q.slow" variant="destructive" class="mr-1">
                        {{ t("admin.observability.slowBadge") }}
                      </Badge>
                      <Badge v-if="q.error" variant="destructive" class="mr-1">
                        {{ t("admin.observability.errorBadge") }}
                      </Badge>
                      {{ q.sql }}
                    </TableCell>
                    <TableCell class="font-mono text-xs">
                      {{ formatDuration(q.duration_ns / 1000000) }}
                    </TableCell>
                    <TableCell>{{ formatNumber(q.rows) }}</TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ q.caller }}
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ formatTimestamp(q.timestamp) }}
                    </TableCell>
                  </TableRow>
                  <TableRow v-if="snapshot.queries.recent.length === 0">
                    <TableCell
                      colspan="5"
                      class="py-8 text-center text-muted-foreground"
                    >
                      {{ t("admin.observability.noQueries") }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Slow queries -->
        <TabsContent value="slow">
          <Card>
            <CardContent class="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[50%]">SQL</TableHead>
                    <TableHead>{{
                      t("admin.observability.duration")
                    }}</TableHead>
                    <TableHead>{{ t("admin.observability.rows") }}</TableHead>
                    <TableHead>{{ t("admin.observability.caller") }}</TableHead>
                    <TableHead>{{ t("admin.observability.time") }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="(q, i) in snapshot.queries.slow_queries"
                    :key="i"
                    class="bg-destructive/5"
                  >
                    <TableCell class="max-w-md truncate font-mono text-xs">
                      {{ q.sql }}
                    </TableCell>
                    <TableCell class="font-mono text-xs font-semibold">
                      {{ formatDuration(q.duration_ns / 1000000) }}
                    </TableCell>
                    <TableCell>{{ formatNumber(q.rows) }}</TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ q.caller }}
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ formatTimestamp(q.timestamp) }}
                    </TableCell>
                  </TableRow>
                  <TableRow v-if="snapshot.queries.slow_queries.length === 0">
                    <TableCell
                      colspan="5"
                      class="py-8 text-center text-muted-foreground"
                    >
                      {{ t("admin.observability.noSlowQueries") }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- N+1 patterns -->
        <TabsContent value="n1">
          <Card>
            <CardContent class="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[50%]">
                      {{ t("admin.observability.sqlPattern") }}
                    </TableHead>
                    <TableHead>{{ t("admin.observability.count") }}</TableHead>
                    <TableHead>{{
                      t("admin.observability.totalTime")
                    }}</TableHead>
                    <TableHead>{{ t("admin.observability.caller") }}</TableHead>
                    <TableHead>{{
                      t("admin.observability.traceId")
                    }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="(p, i) in snapshot.queries.n1_patterns"
                    :key="i"
                    class="bg-destructive/5"
                  >
                    <TableCell class="max-w-md truncate font-mono text-xs">
                      {{ p.sql }}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {{
                          t("admin.observability.times", {
                            count: formatNumber(p.count),
                          })
                        }}
                      </Badge>
                    </TableCell>
                    <TableCell class="font-mono text-xs">
                      {{ formatDecimal(p.total_ms, 1) }}ms
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ p.caller }}
                    </TableCell>
                    <TableCell
                      class="max-w-[120px] truncate font-mono text-xs text-muted-foreground"
                    >
                      {{ p.trace_id || "—" }}
                    </TableCell>
                  </TableRow>
                  <TableRow v-if="snapshot.queries.n1_patterns.length === 0">
                    <TableCell
                      colspan="5"
                      class="py-8 text-center text-muted-foreground"
                    >
                      {{ t("admin.observability.noN1Patterns") }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
