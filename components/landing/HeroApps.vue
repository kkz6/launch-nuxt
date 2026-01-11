<script setup lang="ts"></script>

<template>
  <section class="site-section flex min-h-[50vh] items-center bg-[hsl(var(--site-bg))]">
    <div class="site-grid-pattern absolute inset-0" />
    <div class="site-noise pointer-events-none absolute inset-0" />

    <div class="site-glow -top-40 left-1/4 h-[500px] w-[500px] bg-violet-500" />
    <div class="site-glow right-0 top-0 h-[400px] w-[400px] translate-x-1/2 bg-cyan-500" />

    <div class="site-container relative pb-10 pt-32 md:pt-40">
      <div class="mx-auto max-w-3xl text-center" data-aos="fade-up">
        <div
          class="mb-6 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--site-border))] bg-[hsl(var(--site-text))]/5 px-3 py-1 text-sm text-[hsl(var(--site-text-muted))]"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-violet-400" />
          Powerful ecosystem
        </div>
        <h1 class="font-site mb-6 text-5xl font-bold text-[hsl(var(--site-text))] md:text-6xl">
          <span class="site-text-gradient">Integrations</span>
        </h1>
        <p class="mx-auto max-w-2xl text-xl text-[hsl(var(--site-text-muted))]">
          Seamlessly integrate these tools and apps, making your workflow faster and more efficient.
        </p>
      </div>
    </div>
  </section>
</template>
