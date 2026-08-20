<script lang="ts" setup>
import type { HTMLAttributes } from "vue";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
const { t } = useI18n();
</script>

<template>
  <nav :aria-label="t('common.ui.breadcrumb')" :class="props.class">
    <slot />
  </nav>
</template>
