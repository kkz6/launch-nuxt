<script setup lang="ts">
import { categorizedFaqs } from "~/constants/faqs";

const { t } = useI18n();
</script>

<template>
  <section class="border-b bg-background py-24">
    <div class="mx-auto max-w-3xl px-6 lg:px-8">
      <div class="mb-12 text-center">
        <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"
          ># {{ t("public.home.faq.eyebrow") }}</span
        >
        <h2
          class="mt-3 font-mono text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          {{ t("public.faq.heading") }}
        </h2>
        <p class="mt-4 text-muted-foreground">
          {{ t("public.faq.description") }}
        </p>
      </div>

      <div class="space-y-8">
        <div
          v-for="(category, categoryIndex) in categorizedFaqs"
          :key="categoryIndex"
        >
          <h3
            class="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-muted-foreground"
          >
            <span :class="['h-2 w-2 rounded-full', category.color]" />
            {{ t(`public.faq.categories.${category.key}.title`) }}
          </h3>
          <div class="space-y-3">
            <LandingFaqAccordion
              v-for="(faq, index) in category.items"
              :id="`faqs-${categoryIndex}-${index}`"
              :key="faq.key"
              :title="
                t(
                  `public.faq.categories.${category.key}.items.${faq.key}.question`,
                )
              "
            >
              {{
                t(
                  `public.faq.categories.${category.key}.items.${faq.key}.answer`,
                )
              }}
            </LandingFaqAccordion>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
