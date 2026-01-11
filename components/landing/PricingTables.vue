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
  <section class="site-section min-h-screen bg-[hsl(var(--site-bg))] py-32">
    <div class="site-grid-pattern absolute inset-0" />
    <div
      class="site-glow left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 bg-emerald-500"
    />
    <div class="site-glow bottom-0 right-0 h-[400px] w-[400px] translate-x-1/2 bg-cyan-500" />

    <div class="site-container relative pt-16">
      <div class="mx-auto mb-12 max-w-3xl text-center" data-aos="fade-up">
        <div
          class="mb-5 inline-flex items-center gap-2 rounded border border-[hsl(var(--site-border))] bg-[hsl(var(--site-text))]/5 px-3 py-1 font-mono text-xs text-[hsl(var(--site-text-muted))]"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          pricing
        </div>
        <h1 class="font-site mb-4 text-3xl font-bold text-[hsl(var(--site-text))] md:text-4xl">
          Plans That <span class="text-emerald-400">Scale With You</span>
        </h1>
        <p class="text-base text-[hsl(var(--site-text-muted))]">
          Start free, upgrade when you're ready. No hidden fees.
        </p>
      </div>

      <div class="mb-12 flex justify-center" data-aos="fade-up" data-aos-delay="100">
        <div
          class="inline-flex rounded border border-[hsl(var(--site-border))] bg-[hsl(var(--site-text))]/5 p-0.5"
        >
          <button
            :class="[
              'rounded px-5 py-2 font-mono text-xs transition-all duration-300',
              annual
                ? 'bg-emerald-500 text-gray-900'
                : 'text-[hsl(var(--site-text-muted))] hover:text-[hsl(var(--site-text))]',
            ]"
            @click="annual = true"
          >
            Yearly
            <span
              :class="[
                'ml-2 rounded px-1.5 py-0.5 text-[10px]',
                annual ? 'bg-gray-900/20 text-gray-900' : 'bg-emerald-500/20 text-emerald-400',
              ]"
            >
              -20%
            </span>
          </button>
          <button
            :class="[
              'rounded px-5 py-2 font-mono text-xs transition-all duration-300',
              !annual
                ? 'bg-emerald-500 text-gray-900'
                : 'text-[hsl(var(--site-text-muted))] hover:text-[hsl(var(--site-text))]',
            ]"
            @click="annual = false"
          >
            Monthly
          </button>
        </div>
      </div>

      <div class="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
        <div
          v-for="(plan, index) in plans"
          :key="plan.name"
          :class="[
            'site-card relative rounded-lg p-6',
            plan.popular ? 'border-emerald-500/50 bg-emerald-500/5' : '',
          ]"
          data-aos="fade-up"
          :data-aos-delay="index * 100"
        >
          <div v-if="plan.popular" class="absolute -top-3 left-1/2 -translate-x-1/2">
            <span class="rounded bg-emerald-500 px-3 py-1 font-mono text-[10px] font-medium text-gray-900">
              Popular
            </span>
          </div>

          <div class="mb-6">
            <h3 class="font-site mb-1 text-base font-semibold text-[hsl(var(--site-text))]">
              {{ plan.name }}
            </h3>
            <p class="text-xs text-[hsl(var(--site-text-muted))]">
              {{ plan.description }}
            </p>
          </div>

          <div class="mb-6">
            <div class="flex items-baseline gap-0.5">
              <span class="font-mono text-xl text-[hsl(var(--site-text))]">$</span>
              <span class="font-mono text-4xl font-bold tabular-nums text-[hsl(var(--site-text))]">
                {{ annual ? Math.floor(plan.yearlyPrice) : plan.monthlyPrice }}
              </span>
              <span
                v-if="annual && plan.yearlyPrice % 1 !== 0"
                class="font-mono text-lg text-[hsl(var(--site-text-muted))]"
              >
                .{{ ((plan.yearlyPrice % 1) * 100).toFixed(0).padStart(2, '0') }}
              </span>
            </div>
            <span class="font-mono text-xs text-[hsl(var(--site-text-muted))]">
              /{{ annual ? 'year' : 'month' }}
            </span>
          </div>

          <ul class="mb-6 space-y-3">
            <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-2">
              <svg
                class="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span class="text-sm text-[hsl(var(--site-text-muted))]">
                {{ feature }}
              </span>
            </li>
          </ul>

          <NuxtLink
            to="/register"
            :class="['btn w-full justify-center', plan.popular ? 'btn-site-primary' : 'btn-site-secondary']"
          >
            {{ plan.cta }}
          </NuxtLink>
        </div>
      </div>

      <div class="mt-12 text-center" data-aos="fade-up">
        <p class="font-mono text-xs text-[hsl(var(--site-text-muted))]">
          14-day free trial • No credit card required
        </p>
      </div>
    </div>
  </section>
</template>
