<script setup lang="ts">
definePageMeta({
  layout: 'site',
})

useHead({ title: 'Pricing' })
</script>

<template>
  <div>
    <LandingPricingTables />
    <LandingFaqs />
    <LandingCtaAlternative
      class="overflow-hidden"
      heading="Deploy your apps and sites with launchctl"
      button-text="Register Now"
      button-link="/register"
    />
  </div>
</template>
