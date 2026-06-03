<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { toast } from "vue-sonner";
import type { AdminOverview } from "~/types";
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

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

useHead({
  title: "Admin — Overview",
});

const overview = ref<AdminOverview | null>(null);
const isLoading = ref(true);

const fetchOverview = async () => {
  isLoading.value = true;
  try {
    const response = await adminService.overview();
    overview.value = response.data;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to load overview");
  } finally {
    isLoading.value = false;
  }
};

const currency = computed(() => overview.value?.currency || "USD");

const formatMoney = (cents: number): string => {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: currency.value,
  });
};

const formatDate = (date?: string | null): string => {
  if (!date) return "";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
};

const revenueDelta = computed(() => {
  if (!overview.value) return null;
  const current = overview.value.revenue_this_month_cents;
  const previous = overview.value.revenue_last_month_cents;
  if (previous === 0) {
    return current > 0 ? { pct: 100, up: true } : { pct: 0, up: true };
  }
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(Math.round(pct)), up: pct >= 0 };
});

const trendMax = computed(() => {
  const trend = overview.value?.revenue_trend ?? [];
  return Math.max(1, ...trend.map((m) => m.total));
});

const barHeight = (total: number): string => {
  const pct = (total / trendMax.value) * 100;
  return `${Math.max(2, Math.round(pct))}%`;
};

onMounted(() => fetchOverview());
</script>

<template>
  <div class="space-y-6 pb-10">
    <AdminTabs />

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else-if="overview">
      <!-- Primary stat cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">
              {{ formatMoney(overview.mrr_cents) }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">
              {{ formatMoney(overview.total_revenue_cents) }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">
              {{ overview.active_subscriptions }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              On Trial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">
              {{ overview.trial_subscriptions }}
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Secondary stats -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              New this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-semibold text-emerald-600">
              +{{ overview.new_subscriptions_mtd }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              Cancelled this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-semibold text-destructive">
              -{{ overview.cancelled_mtd }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              Revenue this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="flex items-baseline gap-2">
              <p class="text-xl font-semibold">
                {{ formatMoney(overview.revenue_this_month_cents) }}
              </p>
              <span
                v-if="revenueDelta"
                class="flex items-center text-xs font-medium"
                :class="
                  revenueDelta.up ? 'text-emerald-600' : 'text-destructive'
                "
              >
                <Icon
                  :name="
                    revenueDelta.up
                      ? 'lucide:arrow-up-right'
                      : 'lucide:arrow-down-right'
                  "
                  class="h-3 w-3"
                />
                {{ revenueDelta.pct }}%
              </span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              vs {{ formatMoney(overview.revenue_last_month_cents) }} last month
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Revenue trend -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Revenue trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            v-if="overview.revenue_trend.length"
            class="flex items-end gap-3 sm:gap-6"
            style="height: 200px"
          >
            <div
              v-for="m in overview.revenue_trend"
              :key="m.month"
              class="flex flex-1 flex-col items-center justify-end gap-2"
            >
              <span class="text-xs font-medium text-muted-foreground">
                {{ formatMoney(m.total) }}
              </span>
              <div
                class="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
                :style="{ height: barHeight(m.total) }"
                :title="`${m.month}: ${formatMoney(m.total)}`"
              />
              <span class="text-xs text-muted-foreground">{{ m.month }}</span>
            </div>
          </div>
          <p v-else class="py-6 text-center text-sm text-muted-foreground">
            No revenue data yet.
          </p>
        </CardContent>
      </Card>

      <!-- Recent payments -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Recent payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead class="text-right">Amount</TableHead>
                <TableHead class="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="(p, i) in overview.recent_payments"
                :key="`${p.team_id}-${i}`"
              >
                <TableCell class="font-medium">{{ p.team_name }}</TableCell>
                <TableCell class="text-right">
                  {{
                    (p.total / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: p.currency || currency,
                    })
                  }}
                </TableCell>
                <TableCell class="text-right text-muted-foreground">
                  {{ formatDate(p.ordered_at) }}
                </TableCell>
              </TableRow>
              <TableRow v-if="overview.recent_payments.length === 0">
                <TableCell
                  colspan="3"
                  class="py-8 text-center text-muted-foreground"
                >
                  No payments yet.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
