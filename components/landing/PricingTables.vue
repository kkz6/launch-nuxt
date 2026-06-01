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
  id: string
  name: string
  description: string
  monthlyPricing: number // cents
  yearlyPricing: number // cents
  features: string[]
  recommended: boolean
}

const plans: Plan[] = [
  {
    id: 'hobby',
    name: 'Hobby',
    description: 'For side projects and learning',
    monthlyPricing: 199,
    yearlyPricing: 2380,
    features: [
      '1 server',
      '1 site per server',
      '5 deployments retained',
      '1 team member',
    ],
    recommended: false,
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'For growing apps and small teams',
    monthlyPricing: 699,
    yearlyPricing: 8388,
    features: [
      '3 servers',
      '10 sites per server',
      '5 deployments retained',
      '1 team member',
      'Database backups',
      'Metrics & monitoring',
    ],
    recommended: true,
  },
  {
    id: 'turbo',
    name: 'Turbo',
    description: 'For heavier production workloads',
    monthlyPricing: 2000,
    yearlyPricing: 24000,
    features: [
      '10 servers',
      '20 sites per server',
      '5 deployments retained',
      '1 team member',
      'Database backups',
      'Metrics & monitoring',
    ],
    recommended: false,
  },
]

const annual = ref(false)

// cents → "1.99" / "20"
const formatPrice = (cents: number) => {
  const dollars = cents / 100
  return dollars % 1 === 0 ? dollars.toString() : dollars.toFixed(2)
}

// Real yearly savings vs paying monthly for 12 months. Same formula as
// the in-app modal. With today's plans this is ~0, so we simply don't
// advertise a discount that doesn't exist.
const savingsPercent = (plan: Plan) => {
  const monthlyTotal = plan.monthlyPricing * 12
  if (monthlyTotal <= 0) return 0
  return Math.round(((monthlyTotal - plan.yearlyPricing) / monthlyTotal) * 100)
}

// Only show the toggle's "save %" hint if at least one plan genuinely
// offers a yearly discount.
const maxSavings = computed(() => Math.max(0, ...plans.map(savingsPercent)))

// Per-month figure shown on the card (yearly billed plans show the
// effective monthly so the comparison is apples-to-apples).
const perMonth = (plan: Plan) =>
  formatPrice(annual.value ? Math.round(plan.yearlyPricing / 12) : plan.monthlyPricing)
</script>

<template>
  <section class="relative border-b bg-background py-24">
    <div class="bp-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]" />

    <div class="relative mx-auto max-w-6xl px-6 pt-12 lg:px-8">
      <div class="mx-auto mb-12 max-w-2xl text-center">
        <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"># pricing</span>
        <h1 class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Plans that scale with you
        </h1>
        <p class="mt-4 text-lg text-muted-foreground">
          Start free, upgrade when you're ready. No hidden fees, no sales calls.
        </p>
      </div>

      <!-- Billing toggle -->
      <div class="mb-12 flex justify-center">
        <div class="inline-flex rounded-lg border bg-card p-1 font-mono text-sm">
          <button
            :class="[
              'rounded-md px-5 py-2 font-medium transition-all',
              !annual ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="annual = false"
          >
            monthly
          </button>
          <button
            :class="[
              'rounded-md px-5 py-2 font-medium transition-all',
              annual ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="annual = true"
          >
            yearly
            <span
              v-if="maxSavings > 0"
              :class="[
                'ml-2 rounded px-1.5 py-0.5 text-xs',
                annual ? 'bg-background/20 text-background' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              ]"
            >
              save {{ maxSavings }}%
            </span>
          </button>
        </div>
      </div>

      <div class="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
        <div
          v-for="plan in plans"
          :key="plan.id"
          :class="[
            'relative flex flex-col rounded-xl border bg-card p-6 shadow-sm transition-all',
            plan.recommended ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : '',
          ]"
        >
          <div v-if="plan.recommended" class="absolute -top-3 left-1/2 -translate-x-1/2">
            <span class="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 font-mono text-xs font-medium text-zinc-950">
              <Icon name="lucide:sparkles" class="h-3 w-3" />
              popular
            </span>
          </div>

          <div class="mb-5">
            <h3 class="font-mono text-lg font-semibold">{{ plan.name }}</h3>
            <p class="mt-1 text-sm text-muted-foreground">{{ plan.description }}</p>
          </div>

          <div class="mb-6">
            <div class="flex items-baseline gap-0.5 font-mono">
              <span class="text-xl text-muted-foreground">$</span>
              <span class="text-4xl font-bold tabular-nums">{{ perMonth(plan) }}</span>
              <span class="ml-1 text-sm text-muted-foreground">/mo</span>
            </div>
            <div class="mt-1.5 h-5 font-mono text-xs text-muted-foreground">
              <span v-if="annual">
                ${{ formatPrice(plan.yearlyPricing) }} billed yearly
                <span
                  v-if="savingsPercent(plan) > 0"
                  class="ml-1 font-medium text-emerald-600 dark:text-emerald-400"
                >
                  · save {{ savingsPercent(plan) }}%
                </span>
              </span>
            </div>
          </div>

          <ul class="mb-6 flex-1 space-y-3">
            <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-2">
              <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
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
            <span :class="plan.recommended ? 'text-zinc-950/50' : 'text-emerald-600 dark:text-emerald-400'">$</span>
            start free trial
          </NuxtLink>
        </div>
      </div>

      <div class="mt-12 text-center">
        <p class="font-mono text-xs text-muted-foreground">
          # 14-day free trial · no credit card required
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
