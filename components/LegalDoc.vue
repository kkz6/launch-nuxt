<script setup lang="ts">
// Shared shell for the legal pages — keeps the header, "last updated" line and
// prose styling consistent and on-brand with the site (--site-* tokens, mono
// accents). Page content is passed in via the default slot.
defineProps<{ title: string; updated: string; intro?: string }>();
const { t } = useI18n();
</script>

<template>
  <section class="relative overflow-hidden bg-[hsl(var(--site-bg))]">
    <div
      class="site-grid-pattern pointer-events-none absolute inset-0 opacity-[0.5] [mask-image:radial-gradient(ellipse_70%_45%_at_50%_-10%,black,transparent)]"
    />
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_80%_-5%,theme(colors.emerald.500/7%),transparent)]"
    />

    <div class="relative mx-auto max-w-3xl px-6 pb-24 pt-28 lg:px-8 lg:pt-32">
      <div
        class="border-b border-[hsl(var(--site-border))] pb-8"
        data-aos="fade-up"
      >
        <span class="font-mono text-xs text-[hsl(var(--site-accent))]"
          ># {{ t("public.legal.eyebrow") }}</span
        >
        <h1
          class="mt-3 font-mono text-4xl font-bold tracking-tight text-[hsl(var(--site-text))] sm:text-5xl"
        >
          {{ title }}
        </h1>
        <p class="mt-3 font-mono text-xs text-[hsl(var(--site-text-muted))]">
          {{ t("public.legal.lastUpdated", { date: updated }) }}
        </p>
        <p
          v-if="intro"
          class="mt-5 text-lg leading-relaxed text-[hsl(var(--site-text-muted))]"
        >
          {{ intro }}
        </p>
      </div>

      <div class="legal mt-10" data-aos="fade-up" data-aos-delay="80">
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.legal :deep(h2) {
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
  font-family: "JetBrains Mono", monospace;
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: hsl(var(--site-text));
}

.legal :deep(h2:first-child) {
  margin-top: 0;
}

.legal :deep(p) {
  margin-bottom: 1rem;
  line-height: 1.75;
  color: hsl(var(--site-text-muted));
}

.legal :deep(ul) {
  margin: 0 0 1.25rem 1.25rem;
  list-style: disc;
}

.legal :deep(li) {
  margin-bottom: 0.5rem;
  line-height: 1.7;
  color: hsl(var(--site-text-muted));
}

.legal :deep(li::marker) {
  color: hsl(var(--site-accent));
}

.legal :deep(strong) {
  font-weight: 600;
  color: hsl(var(--site-text));
}

.legal :deep(a) {
  font-weight: 500;
  color: hsl(var(--site-accent));
  text-underline-offset: 2px;
}

.legal :deep(a:hover) {
  text-decoration: underline;
}

.legal :deep(.lead) {
  border-radius: 0.75rem;
  border: 1px solid hsl(var(--site-accent) / 0.25);
  background: hsl(var(--site-accent) / 0.06);
  padding: 1rem 1.25rem;
  color: hsl(var(--site-text));
}
</style>
