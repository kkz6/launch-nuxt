<script setup lang="ts">
definePageMeta({
  layout: 'site',
})

useHead({ title: 'Documentation' })
</script>

<template>
  <div>
    <LandingHeroSupport />
    <LandingDocsFeatures />
    <LandingFaqs />
    <LandingCtaAlternative
      class="overflow-hidden"
      heading="Ready to get started?"
      button-text="Start deploying"
      button-link="/register"
    />
  </div>
</template>
