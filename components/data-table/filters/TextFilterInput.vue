<script setup lang="ts">
import { Input } from "~/components/ui/input";
const { t } = useI18n();
defineProps<{ value: string }>();
const emit = defineEmits<{ update: [value: string] }>();
</script>
<template>
  <Input
    :model-value="value"
    :placeholder="t('data.enterValue')"
    @update:model-value="emit('update', String($event))"
  />
</template>
