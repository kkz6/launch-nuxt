<script setup lang="ts">
definePageMeta({
  layout: 'site',
})

useHead({ title: 'Integrations - Launch' })
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
