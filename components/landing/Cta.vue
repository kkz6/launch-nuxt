<script setup lang="ts"></script>

<template>
  <section class="site-section bg-[hsl(var(--site-bg))] py-20">
    <div class="site-grid-pattern absolute inset-0" />

    <div class="site-container relative">
      <div class="site-card relative overflow-hidden rounded-lg" data-aos="zoom-y-out">
        <div class="absolute inset-0 bg-emerald-500/5" />

        <div class="site-glow -bottom-32 -left-32 h-[300px] w-[300px] bg-emerald-500 opacity-20" />

        <div class="relative px-6 py-12 text-center md:px-12 md:py-16">
          <h2 class="font-site mb-4 text-2xl font-bold text-[hsl(var(--site-text))] md:text-3xl">
            Ready to <span class="text-emerald-400">Launch</span>?
          </h2>
          <p class="mx-auto mb-6 max-w-xl text-sm text-[hsl(var(--site-text-muted))]">
            Simplify your deployment workflow. Start deploying in minutes, not hours.
          </p>
          <div class="flex flex-wrap justify-center gap-3">
            <NuxtLink to="/register" class="btn btn-site-primary group">
              Start Deploying
              <svg
                class="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :stroke-width="2"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </NuxtLink>
            <NuxtLink to="/support" class="btn btn-site-secondary"> Documentation </NuxtLink>
          </div>
          <p class="mt-5 font-mono text-[10px] text-[hsl(var(--site-text-muted))]">
            No credit card required • 14-day free trial
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
