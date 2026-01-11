<script setup lang="ts">
definePageMeta({
  layout: 'site',
})

useHead({ title: 'Refund Policy - Launch' })

const { data: policy } = await useAsyncData('refund-policy', () =>
  $api<{ policy: string }>('/legal/refund-policy')
)
</script>

<template>
  <div>
    <section class="relative">
      <div class="site-grid-pattern absolute inset-0" />
      <div class="site-glow -top-40 left-1/4 h-[500px] w-[500px] bg-emerald-500 opacity-20" />

      <div class="mx-auto max-w-6xl px-4 sm:px-6">
        <div class="mx-auto max-w-3xl pb-12 pt-32 md:pb-20 md:pt-40">
          <div class="pb-10 text-center">
            <h1 class="font-site mb-6 text-4xl font-bold text-[hsl(var(--site-text))] md:text-5xl">
              Refund Policy
            </h1>
          </div>
        </div>
      </div>
    </section>
    <section>
      <div class="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div
          v-if="policy?.policy"
          class="prose prose-invert max-w-full"
          v-html="policy.policy"
        />
        <div v-else class="text-center text-[hsl(var(--site-text-muted))]">
          <p>Refund policy content is not available.</p>
        </div>
      </div>
    </section>
  </div>
</template>
