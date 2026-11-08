<script setup lang="ts">
import type { ObservabilitySnapshot } from "~/types";
import { adminService } from "~/services/adminService";
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
import AdminPageHeader from "~/components/admin/PageHeader.vue";

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
const isRefreshing = ref(false);
const loadError = ref("");
const autoRefresh = ref(true);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const fetchSnapshot = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  try {
    const response = await adminService.observabilitySnapshot();
    snapshot.value = response.data;
    loadError.value = "";
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    loadError.value = err.data?.message || t("admin.observability.loadFailed");
  } finally {
    isLoading.value = false;
    isRefreshing.value = false;
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
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString(locale.value);
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
  <div class="space-y-7">
    <!-- Header -->
    <AdminPageHeader
      :title="t('admin.observability.title')"
      :description="t('admin.observability.description')"
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-3">
          <label
            class="inline-flex min-h-8 items-center gap-2 text-xs text-muted-foreground"
          >
            <input
              v-model="autoRefresh"
              type="checkbox"
              class="h-3.5 w-3.5 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {{ t("admin.observability.autoRefresh", { seconds: 5 }) }}
          </label>
          <button
            type="button"
            class="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            :disabled="isRefreshing"
            :aria-busy="isRefreshing"
            @click="fetchSnapshot"
          >
            <Icon
              name="lucide:refresh-cw"
              class="h-4 w-4"
              :class="{ 'animate-spin': isRefreshing }"
            />
            {{ t("admin.observability.refresh") }}
          </button>
        </div>
      </template>
    </AdminPageHeader>

    <div
      v-if="loadError"
      role="alert"
      class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
    >
      <p>{{ loadError }}</p>
      <p v-if="snapshot" class="mt-1 text-muted-foreground">
        {{ t("admin.observability.staleData") }}
      </p>
    </div>
    <p
      v-if="snapshot"
      class="flex items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
    >
      <Icon name="lucide:clock-3" class="h-3.5 w-3.5" />
      {{
        t("admin.observability.lastUpdated", {
          time: formatTimestamp(snapshot.timestamp),
        })
      }}
    </p>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else-if="snapshot">
      <!-- Runtime summary -->
      <div
        class="grid grid-cols-2 gap-x-8 gap-y-5 border-y border-border/70 py-5 sm:grid-cols-3 xl:grid-cols-5"
      >
        <div class="min-w-0">
          <div class="mb-2">
            <h2 class="text-xs font-medium text-muted-foreground">
              {{ t("admin.observability.uptime") }}
            </h2>
          </div>
          <div>
            <p class="text-2xl font-semibold tracking-tight tabular-nums">
              {{ snapshot.runtime.uptime }}
            </p>
          </div>
        </div>

        <div class="min-w-0">
          <div class="mb-2">
            <h2 class="text-xs font-medium text-muted-foreground">
              {{ t("admin.observability.goroutines") }}
            </h2>
          </div>
          <div>
            <p class="text-2xl font-semibold tracking-tight tabular-nums">
              {{ formatNumber(snapshot.runtime.goroutines) }}
            </p>
          </div>
        </div>

        <div class="min-w-0">
          <div class="mb-2">
            <h2 class="text-xs font-medium text-muted-foreground">
              {{ t("admin.observability.heapAlloc") }}
            </h2>
          </div>
          <div>
            <p class="text-2xl font-semibold tracking-tight tabular-nums">
              {{ formatDecimal(snapshot.runtime.heap_alloc_mb, 1) }} MB
            </p>
            <Progress :model-value="memoryPercent" class="mt-2 h-1.5" />
          </div>
        </div>

        <div class="min-w-0">
          <div class="mb-2">
            <h2 class="text-xs font-medium text-muted-foreground">
              {{ t("admin.observability.gcPauses") }}
            </h2>
          </div>
          <div>
            <p class="text-2xl font-semibold tracking-tight tabular-nums">
              {{ formatDecimal(snapshot.runtime.last_gc_pause_ms, 2) }}ms
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{
                t("admin.observability.cycles", {
                  count: formatNumber(snapshot.runtime.num_gc),
                })
              }}
            </p>
          </div>
        </div>

        <div class="min-w-0">
          <div class="mb-2">
            <h2 class="text-xs font-medium text-muted-foreground">
              {{ t("admin.observability.avgQuery") }}
            </h2>
          </div>
          <div>
            <p class="text-2xl font-semibold tracking-tight tabular-nums">
              {{ formatDuration(snapshot.queries.avg_ms) }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{
                t("admin.observability.total", {
                  count: formatNumber(snapshot.queries.total),
                })
              }}
            </p>
          </div>
        </div>
      </div>

      <div class="grid gap-x-12 gap-y-7 lg:grid-cols-2">
        <!-- DB Pool -->
        <section class="min-w-0">
          <div class="mb-5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-sm font-semibold">
                {{ t("admin.observability.dbConnectionPool") }}
              </h2>
              <Badge :variant="poolStatus">
                {{
                  t("admin.observability.percentUsed", {
                    percent: formatNumber(poolUsagePercent),
                  })
                }}
              </Badge>
            </div>
          </div>
          <div>
            <div
              v-if="snapshot.db_pool"
              class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3"
            >
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.maxOpen") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ formatNumber(snapshot.db_pool.max_open) }}
                </p>
              </div>
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.open") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ formatNumber(snapshot.db_pool.open) }}
                </p>
              </div>
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.inUse") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ formatNumber(snapshot.db_pool.in_use) }}
                </p>
              </div>
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.idle") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ formatNumber(snapshot.db_pool.idle) }}
                </p>
              </div>
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.waitCount") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ formatNumber(snapshot.db_pool.wait_count) }}
                </p>
              </div>
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.waitDuration") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ snapshot.db_pool.wait_duration }}
                </p>
              </div>
            </div>
            <Progress :model-value="poolUsagePercent" class="mt-5 h-1" />
          </div>
        </section>

        <!-- Runtime Details -->
        <section class="min-w-0">
          <div class="mb-5">
            <h2 class="text-sm font-semibold">
              {{ t("admin.observability.goRuntime") }}
            </h2>
          </div>
          <div>
            <div class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.heapInUse") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ formatDecimal(snapshot.runtime.heap_inuse_mb, 1) }} MB
                </p>
              </div>
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.heapObjects") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ formatDecimal(snapshot.runtime.heap_objects_k, 1) }}K
                </p>
              </div>
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.stackInUse") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ formatDecimal(snapshot.runtime.stack_inuse_mb, 1) }} MB
                </p>
              </div>
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.systemMemory") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ formatDecimal(snapshot.runtime.sys_mem_mb, 1) }} MB
                </p>
              </div>
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.gcCpu") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ formatDecimal(snapshot.runtime.gc_cpu_percent, 3) }}%
                </p>
              </div>
              <div>
                <p class="mb-1 text-xs text-muted-foreground">
                  {{ t("admin.observability.cpus") }}
                </p>
                <p class="text-sm font-medium tabular-nums">
                  {{ formatNumber(snapshot.runtime.num_cpu) }}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Query tabs -->
      <section
        aria-labelledby="query-analysis-title"
        class="min-w-0 border-t border-border/70 pt-6"
      >
        <div class="mb-5 flex items-start gap-3">
          <div class="pt-0.5 text-primary">
            <Icon name="lucide:database" class="h-4 w-4" />
          </div>
          <div class="min-w-0">
            <h2 id="query-analysis-title" class="mb-1 text-sm font-semibold">
              {{ t("adminResources.observability.queryAnalysis") }}
            </h2>
            <div class="space-y-1 text-xs leading-5 text-muted-foreground">
              <p>
                {{
                  snapshot.queries.capacity
                    ? t("admin.observability.sampleWindow", {
                        count: formatNumber(snapshot.queries.total),
                        capacity: formatNumber(snapshot.queries.capacity),
                      })
                    : t("admin.observability.sampleCount", {
                        count: formatNumber(snapshot.queries.total),
                      })
                }}
              </p>
              <p v-if="snapshot.queries.slow_threshold_ms != null">
                {{
                  t("admin.observability.slowThreshold", {
                    duration: formatDuration(
                      snapshot.queries.slow_threshold_ms,
                    ),
                  })
                }}
              </p>
            </div>
          </div>
        </div>
        <Tabs default-value="recent" class="space-y-4">
          <TabsList
            class="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-border/70 bg-transparent p-0"
          >
            <TabsTrigger
              value="recent"
              class="shrink-0 rounded-none border-b-2 border-transparent px-0 pb-3 pt-1 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {{ t("admin.observability.recentQueries") }}
              <Badge variant="secondary" class="ml-2">
                {{ formatNumber(snapshot.queries.total) }}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="slow"
              class="shrink-0 rounded-none border-b-2 border-transparent px-0 pb-3 pt-1 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
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
            <TabsTrigger
              value="n1"
              class="shrink-0 rounded-none border-b-2 border-transparent px-0 pb-3 pt-1 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
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
            <p class="mb-3 text-xs text-muted-foreground">
              {{
                t("admin.observability.showingQueries", {
                  count: formatNumber(snapshot.queries.recent.length),
                  total: formatNumber(snapshot.queries.total),
                })
              }}
            </p>
            <div class="min-w-0 overflow-x-auto">
              <Table borderless>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[50%]">SQL</TableHead>
                    <TableHead>{{
                      t("admin.observability.duration")
                    }}</TableHead>
                    <TableHead>{{ t("admin.observability.rows") }}</TableHead>
                    <TableHead>{{ t("admin.observability.caller") }}</TableHead>
                    <TableHead>{{
                      t("admin.observability.request")
                    }}</TableHead>
                    <TableHead>{{ t("admin.observability.time") }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="q in snapshot.queries.recent"
                    :key="q.timestamp + q.sql"
                    :class="{ 'bg-destructive/5': q.slow }"
                  >
                    <TableCell class="max-w-md font-mono text-xs">
                      <Badge v-if="q.slow" variant="destructive" class="mr-1">
                        {{ t("admin.observability.slowBadge") }}
                      </Badge>
                      <Badge v-if="q.error" variant="destructive" class="mr-1">
                        {{ t("admin.observability.errorBadge") }}
                      </Badge>
                      <details>
                        <summary class="cursor-pointer space-y-1">
                          <span class="line-clamp-2 break-all">{{
                            q.sql
                          }}</span>
                          <span class="font-sans text-muted-foreground">{{
                            t("admin.observability.inspectQuery")
                          }}</span>
                        </summary>
                        <pre
                          class="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3"
                          >{{ q.sql }}</pre
                        >
                        <p v-if="q.trace_id" class="mt-2 break-all">
                          {{ t("admin.observability.traceId") }}:
                          {{ q.trace_id }}
                        </p>
                        <p
                          v-if="q.error"
                          class="mt-2 break-all text-destructive"
                        >
                          {{ q.error }}
                        </p>
                      </details>
                    </TableCell>
                    <TableCell class="font-mono text-xs">
                      {{ formatDuration(q.duration_ns / 1000000) }}
                    </TableCell>
                    <TableCell>{{ formatNumber(q.rows) }}</TableCell>
                    <TableCell
                      class="max-w-xs break-all text-xs text-muted-foreground"
                    >
                      {{ q.caller || "—" }}
                    </TableCell>
                    <TableCell class="max-w-xs text-xs">
                      <p class="break-all font-mono">
                        {{
                          [q.method, q.route].filter(Boolean).join(" ") ||
                          t("admin.observability.noRequestContext")
                        }}
                      </p>
                      <p
                        v-if="q.request_id"
                        class="mt-1 break-all font-mono text-muted-foreground"
                      >
                        {{ q.request_id }}
                      </p>
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ formatTimestamp(q.timestamp) }}
                    </TableCell>
                  </TableRow>
                  <TableRow v-if="snapshot.queries.recent.length === 0">
                    <TableCell
                      colspan="6"
                      class="py-8 text-center text-muted-foreground"
                    >
                      {{ t("admin.observability.noQueries") }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <!-- Slow queries -->
          <TabsContent value="slow">
            <p class="mb-3 text-xs text-muted-foreground">
              {{
                t("admin.observability.showingQueries", {
                  count: formatNumber(snapshot.queries.slow_queries.length),
                  total: formatNumber(snapshot.queries.slow_count),
                })
              }}
            </p>
            <div class="min-w-0 overflow-x-auto">
              <Table borderless>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[50%]">SQL</TableHead>
                    <TableHead>{{
                      t("admin.observability.duration")
                    }}</TableHead>
                    <TableHead>{{ t("admin.observability.rows") }}</TableHead>
                    <TableHead>{{ t("admin.observability.caller") }}</TableHead>
                    <TableHead>{{
                      t("admin.observability.request")
                    }}</TableHead>
                    <TableHead>{{ t("admin.observability.time") }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="q in snapshot.queries.slow_queries"
                    :key="q.timestamp + q.sql"
                    class="bg-destructive/5"
                  >
                    <TableCell class="max-w-md font-mono text-xs">
                      <details>
                        <summary class="cursor-pointer space-y-1">
                          <span class="line-clamp-2 break-all">{{
                            q.sql
                          }}</span>
                          <span class="font-sans text-muted-foreground">{{
                            t("admin.observability.inspectQuery")
                          }}</span>
                        </summary>
                        <pre
                          class="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3"
                          >{{ q.sql }}</pre
                        >
                        <p v-if="q.trace_id" class="mt-2 break-all">
                          {{ t("admin.observability.traceId") }}:
                          {{ q.trace_id }}
                        </p>
                        <p
                          v-if="q.error"
                          class="mt-2 break-all text-destructive"
                        >
                          {{ q.error }}
                        </p>
                      </details>
                    </TableCell>
                    <TableCell class="font-mono text-xs font-semibold">
                      {{ formatDuration(q.duration_ns / 1000000) }}
                    </TableCell>
                    <TableCell>{{ formatNumber(q.rows) }}</TableCell>
                    <TableCell
                      class="max-w-xs break-all text-xs text-muted-foreground"
                    >
                      {{ q.caller || "—" }}
                    </TableCell>
                    <TableCell class="max-w-xs text-xs">
                      <p class="break-all font-mono">
                        {{
                          [q.method, q.route].filter(Boolean).join(" ") ||
                          t("admin.observability.noRequestContext")
                        }}
                      </p>
                      <p
                        v-if="q.request_id"
                        class="mt-1 break-all font-mono text-muted-foreground"
                      >
                        {{ q.request_id }}
                      </p>
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ formatTimestamp(q.timestamp) }}
                    </TableCell>
                  </TableRow>
                  <TableRow v-if="snapshot.queries.slow_queries.length === 0">
                    <TableCell
                      colspan="6"
                      class="py-8 text-center text-muted-foreground"
                    >
                      {{ t("admin.observability.noSlowQueries") }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <!-- N+1 patterns -->
          <TabsContent value="n1">
            <p class="mb-4 max-w-3xl text-xs leading-5 text-muted-foreground">
              {{
                snapshot.queries.n1_threshold
                  ? t("admin.observability.n1Explanation", {
                      count: formatNumber(snapshot.queries.n1_threshold),
                    })
                  : t("admin.observability.legacyN1Explanation")
              }}
            </p>
            <div class="min-w-0 overflow-x-auto">
              <Table borderless>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[50%]">
                      {{ t("admin.observability.sqlPattern") }}
                    </TableHead>
                    <TableHead>{{ t("admin.observability.count") }}</TableHead>
                    <TableHead>{{
                      t("admin.observability.totalTime")
                    }}</TableHead>
                    <TableHead>{{
                      t("admin.observability.avgQuery")
                    }}</TableHead>
                    <TableHead>{{ t("admin.observability.caller") }}</TableHead>
                    <TableHead>{{
                      t("admin.observability.request")
                    }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="p in snapshot.queries.n1_patterns"
                    :key="
                      JSON.stringify([
                        p.request_id || p.timestamp,
                        p.sql,
                        p.caller,
                      ])
                    "
                    class="bg-destructive/5"
                  >
                    <TableCell class="max-w-md font-mono text-xs">
                      <details>
                        <summary class="cursor-pointer space-y-1">
                          <span class="line-clamp-2 break-all">{{
                            p.sql
                          }}</span>
                          <span class="font-sans text-muted-foreground">{{
                            t("admin.observability.inspectQuery")
                          }}</span>
                        </summary>
                        <pre
                          class="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3"
                          >{{ p.sql }}</pre
                        >
                        <p class="mt-2 font-sans text-muted-foreground">
                          {{
                            t("admin.observability.lastSeen", {
                              time: formatTimestamp(p.timestamp),
                            })
                          }}
                        </p>
                        <p v-if="p.trace_id" class="mt-2 break-all">
                          {{ t("admin.observability.traceId") }}:
                          {{ p.trace_id }}
                        </p>
                      </details>
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
                      {{ formatDuration(p.total_ms) }}
                    </TableCell>
                    <TableCell class="font-mono text-xs">
                      {{
                        formatDuration(
                          p.avg_ms ?? (p.count > 0 ? p.total_ms / p.count : 0),
                        )
                      }}
                    </TableCell>
                    <TableCell
                      class="max-w-xs break-all text-xs text-muted-foreground"
                    >
                      {{ p.caller || "—" }}
                    </TableCell>
                    <TableCell class="max-w-xs text-xs">
                      <p class="break-all font-mono">
                        {{
                          [p.method, p.route].filter(Boolean).join(" ") ||
                          t("admin.observability.noRequestContext")
                        }}
                      </p>
                      <p
                        v-if="p.request_id"
                        class="mt-1 break-all font-mono text-muted-foreground"
                      >
                        {{ p.request_id }}
                      </p>
                    </TableCell>
                  </TableRow>
                  <TableRow v-if="snapshot.queries.n1_patterns.length === 0">
                    <TableCell
                      colspan="6"
                      class="py-8 text-center text-muted-foreground"
                    >
                      {{ t("admin.observability.noN1Patterns") }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </template>
  </div>
</template>
