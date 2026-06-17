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

setBreadcrumbs([
  { label: "Admin", to: "/admin/overview" },
  { label: "Observability" },
]);

useHead({
  title: "Admin — Observability",
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
    toast.error(err.data?.message || "Failed to load observability data");
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

const poolStatus = computed(() => {
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
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatTimestamp = (ts: string): string => {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  } catch {
    return ts;
  }
};
</script>

<template>
  <div class="space-y-6 pb-10">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold">Observability</h2>
        <p class="text-sm text-muted-foreground">
          Runtime metrics, query analysis, and N+1 detection
        </p>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            v-model="autoRefresh"
            type="checkbox"
            class="rounded border-input"
          />
          Auto-refresh (5s)
        </label>
        <button
          class="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
          @click="fetchSnapshot"
        >
          Refresh
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
              Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-bold">{{ snapshot.runtime.uptime }}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              Goroutines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-bold">
              {{ snapshot.runtime.goroutines.toLocaleString() }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              Heap Alloc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-bold">
              {{ snapshot.runtime.heap_alloc_mb.toFixed(1) }} MB
            </p>
            <Progress :model-value="memoryPercent" class="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              GC Pauses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-bold">
              {{ snapshot.runtime.last_gc_pause_ms.toFixed(2) }}ms
            </p>
            <p class="text-xs text-muted-foreground">
              {{ snapshot.runtime.num_gc }} cycles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              Avg Query
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-bold">
              {{ formatDuration(snapshot.queries.avg_ms) }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ snapshot.queries.total }} total
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- DB Pool -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle class="text-base">DB Connection Pool</CardTitle>
            <Badge :variant="poolStatus as 'default' | 'destructive'">
              {{ poolUsagePercent }}% used
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div
            v-if="snapshot.db_pool"
            class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
          >
            <div>
              <p class="text-sm text-muted-foreground">Max Open</p>
              <p class="text-lg font-semibold">
                {{ snapshot.db_pool.max_open }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Open</p>
              <p class="text-lg font-semibold">{{ snapshot.db_pool.open }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">In Use</p>
              <p class="text-lg font-semibold">{{ snapshot.db_pool.in_use }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Idle</p>
              <p class="text-lg font-semibold">{{ snapshot.db_pool.idle }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Wait Count</p>
              <p class="text-lg font-semibold">
                {{ snapshot.db_pool.wait_count }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Wait Duration</p>
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
          <CardTitle class="text-base">Go Runtime</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            <div>
              <p class="text-sm text-muted-foreground">Heap In Use</p>
              <p class="text-lg font-semibold">
                {{ snapshot.runtime.heap_inuse_mb.toFixed(1) }} MB
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Heap Objects</p>
              <p class="text-lg font-semibold">
                {{ snapshot.runtime.heap_objects_k.toFixed(1) }}K
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Stack In Use</p>
              <p class="text-lg font-semibold">
                {{ snapshot.runtime.stack_inuse_mb.toFixed(1) }} MB
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">System Memory</p>
              <p class="text-lg font-semibold">
                {{ snapshot.runtime.sys_mem_mb.toFixed(1) }} MB
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">GC CPU %</p>
              <p class="text-lg font-semibold">
                {{ snapshot.runtime.gc_cpu_percent.toFixed(3) }}%
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">CPUs</p>
              <p class="text-lg font-semibold">
                {{ snapshot.runtime.num_cpu }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Query tabs -->
      <Tabs default-value="recent" class="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">
            Recent Queries
            <Badge variant="secondary" class="ml-2">
              {{ snapshot.queries.total }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="slow">
            Slow Queries
            <Badge
              :variant="
                snapshot.queries.slow_count > 0 ? 'destructive' : 'secondary'
              "
              class="ml-2"
            >
              {{ snapshot.queries.slow_count }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="n1">
            N+1 Detected
            <Badge
              :variant="
                snapshot.queries.n1_count > 0 ? 'destructive' : 'secondary'
              "
              class="ml-2"
            >
              {{ snapshot.queries.n1_count }}
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
                    <TableHead>Duration</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead>Time</TableHead>
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
                        SLOW
                      </Badge>
                      <Badge
                        v-if="q.error"
                        variant="destructive"
                        class="mr-1"
                      >
                        ERR
                      </Badge>
                      {{ q.sql }}
                    </TableCell>
                    <TableCell class="font-mono text-xs">
                      {{ formatDuration(q.duration_ns / 1000000) }}
                    </TableCell>
                    <TableCell>{{ q.rows }}</TableCell>
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
                      No queries recorded yet.
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
                    <TableHead>Duration</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead>Time</TableHead>
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
                    <TableCell>{{ q.rows }}</TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ q.caller }}
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ formatTimestamp(q.timestamp) }}
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-if="snapshot.queries.slow_queries.length === 0"
                  >
                    <TableCell
                      colspan="5"
                      class="py-8 text-center text-muted-foreground"
                    >
                      No slow queries detected.
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
                    <TableHead class="w-[50%]">SQL Pattern</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Total Time</TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead>Trace ID</TableHead>
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
                        {{ p.count }}x
                      </Badge>
                    </TableCell>
                    <TableCell class="font-mono text-xs">
                      {{ p.total_ms }}ms
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ p.caller }}
                    </TableCell>
                    <TableCell class="max-w-[120px] truncate font-mono text-xs text-muted-foreground">
                      {{ p.trace_id || "—" }}
                    </TableCell>
                  </TableRow>
                  <TableRow v-if="snapshot.queries.n1_patterns.length === 0">
                    <TableCell
                      colspan="5"
                      class="py-8 text-center text-muted-foreground"
                    >
                      No N+1 patterns detected.
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
