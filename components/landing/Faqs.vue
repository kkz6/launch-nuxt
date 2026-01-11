<script setup lang="ts">
import { categorizedFaqs } from '~/constants/faqs'
</script>

<template>
  <section class="site-section bg-[hsl(var(--site-bg))] py-16">
    <div class="site-grid-pattern absolute inset-0" />

    <div class="site-container relative">
      <div class="mx-auto mb-10 max-w-2xl text-center" data-aos="fade-up">
        <h2 class="font-site mb-3 text-2xl font-bold text-[hsl(var(--site-text))]">
          Frequently Asked <span class="text-emerald-400">Questions</span>
        </h2>
        <p class="text-sm text-[hsl(var(--site-text-muted))]">
          Everything you need to know about Launch
        </p>
      </div>

      <div class="mx-auto max-w-2xl space-y-8">
        <div
          v-for="(category, categoryIndex) in categorizedFaqs"
          :key="categoryIndex"
          data-aos="fade-up"
          :data-aos-delay="(categoryIndex + 1) * 100"
        >
          <h3 class="mb-3 flex items-center gap-2 font-mono text-sm font-medium text-[hsl(var(--site-text))]">
            <span :class="['h-1.5 w-1.5 rounded-full', category.color]" />
            {{ category.title }}
          </h3>
          <div class="space-y-3">
            <LandingFaqAccordion
              v-for="(faq, index) in category.items"
              :key="index"
              :title="faq.question"
              :id="`faqs-${categoryIndex}-${index}`"
            >
              {{ faq.answer }}
            </LandingFaqAccordion>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
