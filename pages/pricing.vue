<script setup lang="ts">
definePageMeta({
  layout: 'site',
})

useHead({ title: 'Pricing' })

useSeoMeta({
  description:
    'Simple, transparent pricing for server management. Choose the plan that fits your team and scale as you grow.',
  ogTitle: 'Pricing - launchctl',
  ogDescription:
    'Simple, transparent pricing for server management. Choose the plan that fits your team and scale as you grow.',
  ogImage: '/images/og-image.png',
  ogUrl: 'https://launchctl.dev/pricing',
  ogType: 'website',
  twitterTitle: 'Pricing - launchctl',
  twitterDescription:
    'Simple, transparent pricing for server management. Choose the plan that fits your team and scale as you grow.',
  twitterImage: '/images/og-image.png',
  twitterCard: 'summary_large_image',
})
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
