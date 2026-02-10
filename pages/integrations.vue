<script setup lang="ts">
definePageMeta({
  layout: 'site',
})

useHead({ title: 'Integrations' })

useSeoMeta({
  description:
    'Connect launchctl with GitHub, GitLab, Bitbucket, and leading cloud providers like DigitalOcean, Hetzner, AWS, Vultr, and Linode.',
  ogTitle: 'Integrations - launchctl',
  ogDescription:
    'Connect launchctl with GitHub, GitLab, Bitbucket, and leading cloud providers like DigitalOcean, Hetzner, AWS, Vultr, and Linode.',
  ogImage: '/images/og-image.png',
  ogUrl: 'https://launchctl.dev/integrations',
  ogType: 'website',
  twitterTitle: 'Integrations - launchctl',
  twitterDescription:
    'Connect launchctl with GitHub, GitLab, Bitbucket, and leading cloud providers like DigitalOcean, Hetzner, AWS, Vultr, and Linode.',
  twitterImage: '/images/og-image.png',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <div>
    <LandingHeroApps />
    <LandingAppList />
    <LandingCtaAlternative
      heading="Deploy your next project with Launch"
      button-text="Try for Free"
      button-link="/register"
    />
  </div>
</template>
