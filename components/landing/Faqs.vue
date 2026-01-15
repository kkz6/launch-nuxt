<script setup lang="ts">
import { categorizedFaqs } from '~/constants/faqs'
</script>

<template>
  <section class="relative bg-background py-24">
    <div class="absolute inset-0 bg-gradient-to-t from-muted/30 to-background" />

    <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="mx-auto mb-12 max-w-2xl text-center">
        <h2 class="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Frequently asked <span class="text-primary">questions</span>
        </h2>
        <p class="text-muted-foreground">
          Everything you need to know about launchctl
        </p>
      </div>

      <div class="mx-auto max-w-2xl space-y-8">
        <div
          v-for="(category, categoryIndex) in categorizedFaqs"
          :key="categoryIndex"
        >
          <h3 class="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
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
