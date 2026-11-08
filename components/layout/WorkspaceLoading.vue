<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <div
    role="status"
    class="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
  >
    <Icon
      name="lucide:loader-2"
      class="h-4 w-4 animate-spin"
      aria-hidden="true"
    />
    {{ t("common.loading") }}
  </div>
</template>
