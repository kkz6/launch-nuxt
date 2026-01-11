<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { user } = useAuth();

// Redirect based on onboarding status
onMounted(() => {
  if (user.value?.onboarded) {
    navigateTo("/servers");
  } else {
    navigateTo("/onboarding");
  }
});
</script>

<template>
  <div class="flex items-center justify-center py-12">
    <Icon
      name="lucide:loader-2"
      class="h-8 w-8 animate-spin text-muted-foreground"
    />
  </div>
</template>
