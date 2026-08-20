<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { enUS, ja } from "date-fns/locale";
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

const { locale, t } = useI18n();

const applyBreadcrumb = (): void => {
  setBreadcrumbs([
    { label: t("admin.common.admin"), to: "/admin/overview" },
    { label: t("admin.common.overview") },
  ]);
};
applyBreadcrumb();
watch(locale, applyBreadcrumb);

useHead({
  title: () => t("admin.overview.pageTitle"),
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
    toast.error(err.data?.message || t("admin.overview.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const currency = computed(() => overview.value?.currency || "USD");

const formatMoney = (cents: number): string => {
  return (cents / 100).toLocaleString(locale.value, {
    style: "currency",
    currency: currency.value,
  });
};

const formatDate = (date?: string | null): string => {
  if (!date) return "";
  try {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: locale.value === "ja" ? ja : enUS,
    });
  } catch {
    return "";
  }
};

const formatNumber = (value: number): string =>
  value.toLocaleString(locale.value);

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

onMounted(() => fetchOverview());
</script>

<template>
  <div class="space-y-6 pb-10">
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
              {{ t("admin.overview.mrr") }}
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
              {{ t("admin.overview.totalRevenue") }}
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
              {{ t("admin.overview.activeSubscriptions") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">
              {{ formatNumber(overview.active_subscriptions) }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ t("admin.overview.onTrial") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">
              {{ formatNumber(overview.trial_subscriptions) }}
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Secondary stats -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ t("admin.overview.newThisMonth") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-semibold text-emerald-600">
              +{{ formatNumber(overview.new_subscriptions_mtd) }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ t("admin.overview.cancelledThisMonth") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-xl font-semibold text-destructive">
              -{{ formatNumber(overview.cancelled_mtd) }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              {{ t("admin.overview.revenueThisMonth") }}
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
                {{ formatNumber(revenueDelta.pct) }}%
              </span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{
                t("admin.overview.versusLastMonth", {
                  amount: formatMoney(overview.revenue_last_month_cents),
                })
              }}
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Revenue trend -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">
            {{ t("admin.overview.revenueTrend") }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AdminRevenueTrendChart
            v-if="overview.revenue_trend.length"
            :trend="overview.revenue_trend"
            :currency="currency"
          />
          <p v-else class="py-6 text-center text-sm text-muted-foreground">
            {{ t("admin.overview.noRevenue") }}
          </p>
        </CardContent>
      </Card>

      <!-- Recent payments -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">
            {{ t("admin.overview.recentPayments") }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t("admin.overview.team") }}</TableHead>
                <TableHead class="text-right">
                  {{ t("admin.overview.amount") }}
                </TableHead>
                <TableHead class="text-right">
                  {{ t("admin.overview.date") }}
                </TableHead>
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
                    (p.total / 100).toLocaleString(locale, {
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
                  {{ t("admin.overview.noPayments") }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
