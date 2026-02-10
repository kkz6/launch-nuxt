<script setup lang="ts">
definePageMeta({
  layout: 'site',
})

useHead({ title: 'launchctl - Server Management Made Simple', titleTemplate: '' })

useSeoMeta({
  description:
    'Deploy and manage servers without the complexity. One platform for provisioning, deploying, databases, SSL, and monitoring.',
  ogTitle: 'launchctl - Server Management Made Simple',
  ogDescription:
    'Deploy and manage servers without the complexity. One platform for provisioning, deploying, databases, SSL, and monitoring.',
  ogImage: '/images/og-image.png',
  ogUrl: 'https://launchctl.dev',
  ogType: 'website',
  twitterTitle: 'launchctl - Server Management Made Simple',
  twitterDescription:
    'Deploy and manage servers without the complexity. One platform for provisioning, deploying, databases, SSL, and monitoring.',
  twitterImage: '/images/og-image.png',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <div>
    <LandingHeroHome />
    <LandingBentoGrid />
    <LandingFeaturesHome />
    <LandingBusinessCategories />
    <LandingLargeTestimonial />
    <LandingAppList />
    <LandingDocsFeatures />
    <LandingCta />
  </div>
</template>
