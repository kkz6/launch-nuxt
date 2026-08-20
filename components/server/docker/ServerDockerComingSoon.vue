<script setup lang="ts">
// Generic placeholder for docker server tabs that we haven't shipped yet.
// Lives in components/server/docker/ to match the design doc's layout —
// every docker-server-specific component is under here.
interface Props {
  title: string;
  description: string;
  icon: string;
}
defineProps<Props>();

const { t } = useI18n();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center"
  >
    <Icon :name="icon" class="h-12 w-12 text-muted-foreground" />
    <h2 class="mt-4 text-xl font-semibold">{{ title }}</h2>
    <p class="mt-2 max-w-md text-sm text-muted-foreground">
      {{ description }}
    </p>
    <div
      class="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
    >
      <Icon name="lucide:hammer" class="h-3.5 w-3.5" />
      {{ t("server.comingSoon") }}
    </div>
  </div>
</template>
