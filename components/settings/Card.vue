<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
  showFooter?: boolean;
}

withDefaults(defineProps<Props>(), {
  description: "",
  showFooter: true,
});
</script>

<template>
  <div class="rounded-sm border">
    <div class="space-y-6">
      <!-- Header -->
      <div class="px-4 pt-4">
        <h2 class="text-lg font-medium">{{ title }}</h2>
        <p v-if="description" class="text-sm text-muted-foreground">
          {{ description }}
        </p>
      </div>

      <!-- Content -->
      <div class="px-4">
        <slot />
      </div>

      <!-- Footer -->
      <div v-if="showFooter || $slots.footer" class="mt-4 flex justify-end border-t p-4">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
