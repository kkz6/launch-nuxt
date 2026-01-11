<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

// Redirect to profile settings
onMounted(() => {
  navigateTo('/settings/profile')
})
</script>

<template>
  <div class="flex items-center justify-center py-12">
    <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
</template>
