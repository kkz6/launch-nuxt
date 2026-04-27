<script setup lang="ts">
definePageMeta({
  layout: 'docs',
})

useHead({ title: 'Documentation' })

// Redirect to overview
navigateTo('/docs/overview', { redirectCode: 301 })
</script>

<template>
  <div />
</template>
