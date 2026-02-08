<script setup lang="ts">
useHead({
  htmlAttrs: {
    lang: 'en',
  },
})
</script>

<template>
  <NuxtLoadingIndicator color="hsl(var(--primary))" :height="2" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
