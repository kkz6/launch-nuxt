<script setup lang="ts">
import { categorizedFaqs } from '~/constants/faqs'
</script>

<template>
  <section class="border-b bg-background py-24">
    <div class="mx-auto max-w-3xl px-6 lg:px-8">
      <div class="mb-12 text-center">
        <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"># faq</span>
        <h2 class="mt-3 font-mono text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Good questions
        </h2>
        <p class="mt-4 text-muted-foreground">
          Everything you need to know about launchctl
        </p>
      </div>

      <div class="space-y-8">
        <div
          v-for="(category, categoryIndex) in categorizedFaqs"
          :key="categoryIndex"
        >
          <h3 class="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
            <span :class="['h-2 w-2 rounded-full', category.color]" />
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
