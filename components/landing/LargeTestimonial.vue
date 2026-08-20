<script setup lang="ts">
const stars = [1, 2, 3, 4, 5];
const { t } = useI18n();
</script>

<template>
  <section class="site-section bg-[hsl(var(--site-bg))] py-16">
    <div class="site-grid-pattern absolute inset-0" />

    <div class="site-container relative">
      <div class="mx-auto max-w-3xl text-center" data-aos="fade-up">
        <div class="relative mb-6 inline-block">
          <svg
            class="absolute -left-6 -top-3 h-8 w-8 text-emerald-500/30"
            fill="currentColor"
            viewBox="0 0 32 32"
          >
            <path
              d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z"
            />
          </svg>
          <div
            class="flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/20 font-mono text-lg font-bold text-emerald-400"
          >
            A
          </div>
        </div>

        <blockquote
          class="font-site mb-6 text-lg font-medium leading-relaxed text-[hsl(var(--site-text))] md:text-xl"
        >
          {{ t("public.testimonial.quote") }}
        </blockquote>

        <div class="flex items-center justify-center gap-3">
          <div>
            <div class="text-sm font-medium text-[hsl(var(--site-text))]">
              Anila
            </div>
            <div class="font-mono text-xs text-[hsl(var(--site-text-muted))]">
              {{ t("public.testimonial.role") }}
            </div>
          </div>
        </div>

        <div class="mt-5 flex justify-center gap-0.5">
          <svg
            v-for="star in stars"
            :key="star"
            class="h-4 w-4 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
            />
          </svg>
        </div>
      </div>
    </div>
  </section>
</template>
