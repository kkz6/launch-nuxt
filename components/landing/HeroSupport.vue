<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <section
    class="site-section flex min-h-[40vh] items-center bg-[hsl(var(--site-bg))]"
  >
    <div class="site-grid-pattern absolute inset-0" />
    <div class="site-noise pointer-events-none absolute inset-0" />

    <div
      class="site-glow -top-32 left-1/4 h-[400px] w-[400px] bg-emerald-500 opacity-20"
    />

    <div class="site-container relative pb-10 pt-28 md:pb-14 md:pt-32">
      <div class="mx-auto max-w-2xl text-center" data-aos="fade-up">
        <div
          class="mb-5 inline-flex items-center gap-2 rounded border border-[hsl(var(--site-border))] bg-[hsl(var(--site-text))]/5 px-3 py-1 font-mono text-xs text-[hsl(var(--site-text-muted))]"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {{ t("public.support.documentation") }}
        </div>
        <h1
          class="font-site mb-4 text-3xl font-bold text-[hsl(var(--site-text))] md:text-4xl"
        >
          {{ t("public.support.heroTitle") }}
        </h1>
        <p class="mx-auto max-w-xl text-sm text-[hsl(var(--site-text-muted))]">
          {{ t("public.support.heroDescription") }}
        </p>
      </div>
    </div>
  </section>
</template>
