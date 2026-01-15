<script setup lang="ts">
const plans = [
  {
    name: 'Hobby',
    description: 'Perfect for side projects and learning',
    monthlyPrice: 1.99,
    yearlyPrice: 23.88,
    features: [
      '1 Server',
      '3 Sites per Server',
      '5 Releases per Site',
      'Unlimited cron jobs',
      'Unlimited firewall rules',
      'Community support',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Pro',
    description: 'For growing teams and businesses',
    monthlyPrice: 6.99,
    yearlyPrice: 83.88,
    features: [
      '3 Servers',
      '20 Sites per Server',
      'Unlimited releases',
      'Team collaboration (5 members)',
      'Priority support',
      'Custom domains',
      'Advanced monitoring',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    description: 'For large-scale deployments',
    monthlyPrice: 20,
    yearlyPrice: 240,
    features: [
      '10 Servers',
      'Unlimited sites',
      'Unlimited releases',
      'Unlimited team members',
      '24/7 dedicated support',
      'SSO/SAML',
      'Audit logs',
      'Early access to features',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
]

const annual = ref(true)
</script>

<template>
  <section class="relative min-h-screen bg-background py-32">
    <div class="absolute inset-0 bg-gradient-to-b from-muted/30 to-background" />

    <div class="relative mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
      <div class="mx-auto mb-12 max-w-3xl text-center">
        <div
          class="mb-5 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm"
        >
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span class="text-muted-foreground">Pricing</span>
        </div>
        <h1 class="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Plans that <span class="text-primary">scale with you</span>
        </h1>
        <p class="text-lg text-muted-foreground">
          Start free, upgrade when you're ready. No hidden fees.
        </p>
      </div>

      <div class="mb-12 flex justify-center">
        <div class="inline-flex rounded-lg border bg-muted/50 p-1">
          <button
            :class="[
              'rounded-md px-5 py-2 text-sm font-medium transition-all duration-300',
              annual
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="annual = true"
          >
            Yearly
            <span
              :class="[
                'ml-2 rounded px-1.5 py-0.5 text-xs',
                annual ? 'bg-background/20 text-background' : 'bg-primary/10 text-primary',
              ]"
            >
              -20%
            </span>
          </button>
          <button
            :class="[
              'rounded-md px-5 py-2 text-sm font-medium transition-all duration-300',
              !annual
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="annual = false"
          >
            Monthly
          </button>
        </div>
      </div>

      <div class="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
        <div
          v-for="plan in plans"
          :key="plan.name"
          :class="[
            'relative rounded-xl border bg-card p-6',
            plan.popular ? 'border-primary shadow-lg' : '',
          ]"
        >
          <div v-if="plan.popular" class="absolute -top-3 left-1/2 -translate-x-1/2">
            <span class="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
              Popular
            </span>
          </div>

          <div class="mb-6">
            <h3 class="mb-1 text-lg font-semibold text-foreground">
              {{ plan.name }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{ plan.description }}
            </p>
          </div>

          <div class="mb-6">
            <div class="flex items-baseline gap-0.5">
              <span class="text-xl text-foreground">$</span>
              <span class="text-4xl font-bold tabular-nums text-foreground">
                {{ annual ? Math.floor(plan.yearlyPrice) : plan.monthlyPrice }}
              </span>
              <span
                v-if="annual && plan.yearlyPrice % 1 !== 0"
                class="text-lg text-muted-foreground"
              >
                .{{ ((plan.yearlyPrice % 1) * 100).toFixed(0).padStart(2, '0') }}
              </span>
            </div>
            <span class="text-sm text-muted-foreground">
              /{{ annual ? 'year' : 'month' }}
            </span>
          </div>

          <ul class="mb-6 space-y-3">
            <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-2">
              <Icon
                name="lucide:check"
                class="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
              />
              <span class="text-sm text-muted-foreground">
                {{ feature }}
              </span>
            </li>
          </ul>

          <NuxtLink
            to="/register"
            :class="[
              'inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
              plan.popular
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'border bg-background text-foreground hover:bg-muted',
            ]"
          >
            {{ plan.cta }}
          </NuxtLink>
        </div>
      </div>

      <div class="mt-12 text-center">
        <p class="text-sm text-muted-foreground">
          14-day free trial &bull; No credit card required
        </p>
      </div>
    </div>
  </section>
</template>
