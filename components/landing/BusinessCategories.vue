<script setup lang="ts">
const categories = [
  {
    id: 'startups',
    label: 'Startups',
    title: 'Ship Fast',
    description: 'Move quickly without managing infrastructure.',
    features: ['Instant deployments', 'Auto-scaling', 'Free SSL', 'Git integration'],
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    id: 'agencies',
    label: 'Agencies',
    title: 'Manage Clients',
    description: 'One dashboard for all client projects.',
    features: ['Multi-tenant', 'Team collaboration', 'White-label', 'Client access'],
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    title: 'Enterprise Security',
    description: 'Advanced security for large organizations.',
    features: ['SSO/SAML', 'Audit logs', 'RBAC', 'Private network'],
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
]

const activeCategory = ref(categories[0].id)

const active = computed(() => categories.find((c) => c.id === activeCategory.value) || categories[0])
</script>

<template>
  <section class="site-section bg-[hsl(var(--site-bg))] py-16">
    <div class="site-grid-pattern absolute inset-0" />

    <div class="site-container relative">
      <div class="mb-10 text-center" data-aos="fade-up">
        <div
          class="mb-4 inline-flex items-center gap-2 rounded border border-[hsl(var(--site-border))] bg-[hsl(var(--site-text))]/5 px-3 py-1 font-mono text-xs text-[hsl(var(--site-text-muted))]"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          use cases
        </div>
        <h2 class="font-site mb-3 text-2xl font-bold text-[hsl(var(--site-text))] md:text-3xl">
          Built for <span class="text-emerald-400">Every Team</span>
        </h2>
        <p class="mx-auto max-w-lg text-sm text-[hsl(var(--site-text-muted))]">
          Whether you're a solo developer or an enterprise team, Launch scales with your needs.
        </p>
      </div>

      <div class="mb-8 flex justify-center gap-2" data-aos="fade-up" data-aos-delay="100">
        <button
          v-for="category in categories"
          :key="category.id"
          :class="[
            'rounded px-4 py-2 font-mono text-xs transition-all duration-300',
            activeCategory === category.id
              ? 'bg-emerald-500 text-gray-900'
              : 'border border-[hsl(var(--site-border))] bg-[hsl(var(--site-text))]/5 text-[hsl(var(--site-text-muted))] hover:bg-[hsl(var(--site-text))]/10 hover:text-[hsl(var(--site-text))]',
          ]"
          @click="activeCategory = category.id"
        >
          {{ category.label }}
        </button>
      </div>

      <div class="mx-auto max-w-xl" data-aos="fade-up" data-aos-delay="150">
        <div class="site-card rounded-lg p-6 text-center">
          <div
            class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-[hsl(var(--site-border))] bg-emerald-500/10"
          >
            <svg class="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                :stroke-width="1.5"
                :d="active.icon"
              />
            </svg>
          </div>
          <h3 class="font-site mb-2 text-lg font-semibold text-[hsl(var(--site-text))]">
            {{ active.title }}
          </h3>
          <p class="mb-5 text-sm text-[hsl(var(--site-text-muted))]">
            {{ active.description }}
          </p>

          <div class="flex flex-wrap justify-center gap-2">
            <div
              v-for="feature in active.features"
              :key="feature"
              class="flex items-center gap-1.5 rounded border border-[hsl(var(--site-border))] bg-[hsl(var(--site-text))]/5 px-2.5 py-1"
            >
              <svg class="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="font-mono text-[10px] text-[hsl(var(--site-text-muted))]">
                {{ feature }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
