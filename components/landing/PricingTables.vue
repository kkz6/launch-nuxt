<script setup lang="ts">
// Marketing pricing. Mirrors the real billing plans from the backend
// (launch-go internal/modules/billing/models/plan.go → DefaultPlans)
// AND the in-app billing modal's calculation, so what a visitor sees
// here matches what they're actually charged.
//
// Prices are in cents to avoid float drift, exactly like the in-app
// modal. There is NO invented "Enterprise / Contact Sales" tier — the
// real third plan is Turbo, and every plan is self-serve.
interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPricing: number; // cents
  features: string[];
  recommended: boolean;
}

const { t, locale } = useI18n();

const plans = computed<Plan[]>(() => [
  {
    id: "hobby",
    name: t("public.pricing.plans.hobby.name"),
    description: t("public.pricing.plans.hobby.description"),
    monthlyPricing: 199,
    features: [
      t("public.pricing.features.oneServer"),
      t("public.pricing.features.oneSitePerServer"),
      t("public.pricing.features.fiveDeployments"),
      t("public.pricing.features.oneTeamMember"),
    ],
    recommended: false,
  },
  {
    id: "compact",
    name: t("public.pricing.plans.compact.name"),
    description: t("public.pricing.plans.compact.description"),
    monthlyPricing: 699,
    features: [
      t("public.pricing.features.threeServers"),
      t("public.pricing.features.tenSitesPerServer"),
      t("public.pricing.features.fiveDeployments"),
      t("public.pricing.features.oneTeamMember"),
      t("public.pricing.features.databaseBackups"),
      t("public.pricing.features.metricsMonitoring"),
    ],
    recommended: true,
  },
  {
    id: "turbo",
    name: t("public.pricing.plans.turbo.name"),
    description: t("public.pricing.plans.turbo.description"),
    monthlyPricing: 2000,
    features: [
      t("public.pricing.features.tenServers"),
      t("public.pricing.features.twentySitesPerServer"),
      t("public.pricing.features.fiveDeployments"),
      t("public.pricing.features.oneTeamMember"),
      t("public.pricing.features.databaseBackups"),
      t("public.pricing.features.metricsMonitoring"),
    ],
    recommended: false,
  },
]);

// cents → "1.99" / "20"
const formatPrice = (cents: number) => {
  return new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

const perMonth = (plan: Plan) => formatPrice(plan.monthlyPricing);
</script>

<template>
  <section class="relative border-b bg-background py-24">
    <div
      class="bp-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]"
    />

    <div class="relative mx-auto max-w-6xl px-6 pt-12 lg:px-8">
      <div class="mx-auto mb-12 max-w-2xl text-center">
        <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"
          ># {{ t("public.pricing.eyebrow") }}</span
        >
        <h1
          class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl"
        >
          {{ t("public.pricing.heading") }}
        </h1>
        <p class="mt-4 text-lg text-muted-foreground">
          {{ t("public.pricing.description") }}
        </p>
      </div>

      <div class="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
        <div
          v-for="plan in plans"
          :key="plan.id"
          :class="[
            'relative flex flex-col rounded-xl border bg-card p-6 shadow-sm transition-all',
            plan.recommended
              ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
              : '',
          ]"
        >
          <div
            v-if="plan.recommended"
            class="absolute -top-3 left-1/2 -translate-x-1/2"
          >
            <span
              class="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 font-mono text-xs font-medium text-zinc-950"
            >
              <Icon name="lucide:sparkles" class="h-3 w-3" />
              {{ t("public.pricing.popular") }}
            </span>
          </div>

          <div class="mb-5">
            <h3 class="font-mono text-lg font-semibold">{{ plan.name }}</h3>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ plan.description }}
            </p>
          </div>

          <div class="mb-6">
            <div class="flex items-baseline gap-0.5 font-mono">
              <span class="text-4xl font-bold tabular-nums">{{
                perMonth(plan)
              }}</span>
              <span class="ml-1 text-sm text-muted-foreground">{{
                t("public.pricing.perMonth")
              }}</span>
            </div>
          </div>

          <ul class="mb-6 flex-1 space-y-3">
            <li
              v-for="feature in plan.features"
              :key="feature"
              class="flex items-start gap-2"
            >
              <Icon
                name="lucide:check"
                class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
              />
              <span class="text-sm text-muted-foreground">{{ feature }}</span>
            </li>
          </ul>

          <NuxtLink
            to="/register"
            :class="[
              'inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-mono text-sm font-medium transition-colors',
              plan.recommended
                ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                : 'border bg-background text-foreground hover:bg-muted',
            ]"
          >
            <span
              :class="
                plan.recommended
                  ? 'text-zinc-950/50'
                  : 'text-emerald-600 dark:text-emerald-400'
              "
              >$</span
            >
            {{ t("public.pricing.startTrial") }}
          </NuxtLink>
        </div>
      </div>

      <div class="mt-12 text-center">
        <p class="font-mono text-xs text-muted-foreground">
          # {{ t("public.pricing.trialNote") }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bp-grid {
  background-image:
    linear-gradient(to right, hsl(var(--border) / 0.6) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border) / 0.6) 1px, transparent 1px);
  background-size: 3.5rem 3.5rem;
}
</style>
