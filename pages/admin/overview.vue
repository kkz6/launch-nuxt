<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import { toast } from "vue-sonner";
import type { AdminOverview } from "~/types";
import { adminService } from "~/services/adminService";
import PageHeader from "~/components/admin/PageHeader.vue";
import { Button } from "~/components/ui/button";
import {
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
const loadError = ref<string | null>(null);

const fetchOverview = async () => {
  isLoading.value = true;
  loadError.value = null;
  try {
    const response = await adminService.overview();
    overview.value = response.data;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    loadError.value = err.data?.message || t("admin.overview.loadFailed");
    toast.error(loadError.value);
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

const primaryStats = computed(() =>
  overview.value
    ? [
        {
          label: t("admin.overview.mrr"),
          value: formatMoney(overview.value.mrr_cents),
          hint: t("adminShell.monthlyRevenue"),
          icon: "lucide:repeat-2",
        },
        {
          label: t("admin.overview.totalRevenue"),
          value: formatMoney(overview.value.total_revenue_cents),
          hint: t("adminShell.lifetimeRevenue"),
          icon: "lucide:wallet",
        },
        {
          label: t("admin.overview.activeSubscriptions"),
          value: formatNumber(overview.value.active_subscriptions),
          hint: t("adminShell.currentSubscriptions"),
          icon: "lucide:badge-check",
        },
        {
          label: t("admin.overview.onTrial"),
          value: formatNumber(overview.value.trial_subscriptions),
          hint: t("adminShell.trialSubscriptions"),
          icon: "lucide:clock-3",
        },
      ]
    : [],
);

const revenueDelta = computed(() => {
  if (!overview.value) return null;
  const current = overview.value.revenue_this_month_cents;
  const previous = overview.value.revenue_last_month_cents;
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(Math.round(pct)), up: pct >= 0 };
});

onMounted(() => fetchOverview());
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="t('admin.common.overview')"
      :description="t('adminShell.overviewDescription')"
    >
      <template #actions>
        <Button variant="outline" :disabled="isLoading" @click="fetchOverview">
          <Icon
            name="lucide:refresh-cw"
            class="h-4 w-4"
            :class="{ 'animate-spin': isLoading }"
            aria-hidden="true"
          />
          {{ t("adminShell.refresh") }}
        </Button>
      </template>
    </PageHeader>

    <div
      v-if="loadError"
      role="alert"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm"
    >
      <div class="flex items-start gap-2">
        <Icon
          name="lucide:circle-alert"
          class="mt-0.5 h-4 w-4 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div>
          <p>{{ loadError }}</p>
          <p v-if="overview" class="mt-1 text-muted-foreground">
            {{ t("adminShell.staleOverview") }}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        :disabled="isLoading"
        @click="fetchOverview"
        >{{ t("adminShell.retry") }}</Button
      >
    </div>

    <div
      v-if="isLoading && !overview"
      role="status"
      :aria-label="t('adminShell.loading')"
      class="space-y-6"
    >
      <span class="sr-only">{{ t("adminShell.loading") }}</span>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        <div
          v-for="n in 4"
          :key="n"
          class="h-28 animate-pulse border-b border-border/70 py-4"
        >
          <div class="h-3 w-24 rounded bg-muted" />
          <div class="mt-5 h-8 w-28 rounded bg-muted" />
          <div class="mt-3 h-3 w-36 rounded bg-muted" />
        </div>
      </div>
      <div
        class="h-64 animate-pulse border-b border-border/70 bg-muted/30"
        aria-hidden="true"
      />
    </div>

    <template v-if="overview">
      <dl
        class="grid grid-cols-2 gap-y-6 border-b border-border/70 pb-7 lg:grid-cols-4"
      >
        <div
          v-for="(stat, index) in primaryStats"
          :key="stat.label"
          class="min-w-0 pr-4 sm:pr-6"
          :class="{
            'border-l border-border/70 pl-5 sm:pl-6': index % 2 === 1,
            'lg:border-l lg:border-border/70 lg:pl-6': index === 2,
          }"
        >
          <dt
            class="flex items-center gap-2 text-xs font-medium text-muted-foreground"
          >
            <Icon
              :name="stat.icon"
              class="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            {{ stat.label }}
          </dt>
          <dd class="mt-3">
            <p
              class="break-words text-2xl font-semibold tabular-nums"
              :class="index === 0 ? 'text-primary' : 'text-foreground'"
            >
              {{ stat.value }}
            </p>
            <p class="mt-2 text-xs leading-5 text-muted-foreground">
              {{ stat.hint }}
            </p>
          </dd>
        </div>
      </dl>

      <div
        class="grid gap-6 border-b border-border/70 pb-6 xl:grid-cols-[minmax(0,1fr)_260px]"
      >
        <section aria-labelledby="revenue-heading" class="min-w-0">
          <div class="mb-6">
            <h2
              id="revenue-heading"
              class="text-sm font-semibold"
            >
              {{ t("admin.overview.revenueTrend") }}
            </h2>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              {{ t("adminShell.revenueDescription") }}
            </p>
          </div>
          <AdminRevenueTrendChart
            v-if="overview.revenue_trend.length"
            :trend="overview.revenue_trend"
            :currency="currency"
          />
          <div
            v-else
            class="flex h-[240px] flex-col items-center justify-center px-4 text-center"
          >
            <Icon
              name="lucide:chart-no-axes-combined"
              class="mb-3 h-7 w-7 text-muted-foreground/60"
              aria-hidden="true"
            />
            <p class="text-sm text-muted-foreground">
              {{ t("admin.overview.noRevenue") }}
            </p>
          </div>
        </section>

        <section
          aria-labelledby="activity-heading"
          class="border-t border-border/70 pt-6 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0"
        >
          <div class="mb-6">
            <h2
              id="activity-heading"
              class="text-sm font-semibold"
            >
              {{ t("adminShell.subscriptionActivity") }}
            </h2>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              {{ t("adminShell.thisMonth") }}
            </p>
          </div>
          <dl class="space-y-5">
            <div class="flex items-center justify-between gap-4">
              <dt class="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon
                  name="lucide:plus"
                  class="h-3.5 w-3.5 text-primary"
                  aria-hidden="true"
                />
                {{ t("admin.overview.newThisMonth") }}
              </dt>
              <dd class="text-base font-semibold tabular-nums text-primary">
                +{{ formatNumber(overview.new_subscriptions_mtd) }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4">
              <dt class="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon
                  name="lucide:minus"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {{ t("admin.overview.cancelledThisMonth") }}
              </dt>
              <dd class="text-base font-semibold tabular-nums">
                {{ formatNumber(overview.cancelled_mtd) }}
              </dd>
            </div>
            <div class="border-t border-border/70 pt-5">
              <dt class="text-xs text-muted-foreground">
                {{ t("admin.overview.revenueThisMonth") }}
              </dt>
              <dd class="mt-2 flex flex-wrap items-baseline gap-2">
                <span
                  class="text-2xl font-semibold tracking-tight tabular-nums"
                >
                  {{ formatMoney(overview.revenue_this_month_cents) }}
                </span>
                <span
                  v-if="revenueDelta"
                  class="inline-flex items-center gap-0.5 text-xs font-medium"
                  :class="revenueDelta.up ? 'text-primary' : 'text-destructive'"
                >
                  <Icon
                    :name="
                      revenueDelta.up
                        ? 'lucide:arrow-up-right'
                        : 'lucide:arrow-down-right'
                    "
                    class="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  {{ formatNumber(revenueDelta.pct) }}%
                </span>
              </dd>
              <dd class="mt-2 text-xs leading-5 text-muted-foreground">
                {{
                  t("admin.overview.versusLastMonth", {
                    amount: formatMoney(overview.revenue_last_month_cents),
                  })
                }}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section aria-labelledby="payments-heading">
        <div class="mb-5">
          <h2
            id="payments-heading"
            class="text-sm font-semibold"
          >
            {{ t("admin.overview.recentPayments") }}
          </h2>
          <p class="mt-1 text-xs leading-5 text-muted-foreground">
            {{ t("adminShell.paymentsDescription") }}
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <TableHeader class="border-b border-border/70">
              <TableRow class="hover:bg-transparent">
                <TableHead class="h-9 pl-0 text-xs">{{
                  t("admin.overview.team")
                }}</TableHead>
                <TableHead class="h-9 text-right text-xs">{{
                  t("admin.overview.amount")
                }}</TableHead>
                <TableHead class="h-9 pr-0 text-right text-xs">{{
                  t("admin.overview.date")
                }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="(payment, index) in overview.recent_payments"
                :key="`${payment.team_id}-${index}`"
                class="border-border/60 hover:bg-muted/30"
              >
                <TableCell class="py-3.5 pl-0 font-medium">{{
                  payment.team_name
                }}</TableCell>
                <TableCell class="text-right font-medium tabular-nums">
                  {{
                    (payment.total / 100).toLocaleString(locale, {
                      style: "currency",
                      currency: payment.currency || currency,
                    })
                  }}
                </TableCell>
                <TableCell
                  class="whitespace-nowrap pr-0 text-right text-xs text-muted-foreground"
                >
                  {{ formatDate(payment.ordered_at) }}
                </TableCell>
              </TableRow>
              <TableRow v-if="overview.recent_payments.length === 0">
                <TableCell
                  colspan="3"
                  class="py-12 text-center text-sm text-muted-foreground"
                >
                  {{ t("admin.overview.noPayments") }}
                </TableCell>
              </TableRow>
            </TableBody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
