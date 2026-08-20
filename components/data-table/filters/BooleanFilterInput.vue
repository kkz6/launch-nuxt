<script setup lang="ts">
import { Button } from "~/components/ui/button";
const { t } = useI18n();
defineProps<{ clause: string }>();
const emit = defineEmits<{ update: [clause: string] }>();
</script>
<template>
  <div class="flex gap-2">
    <Button
      size="sm"
      :variant="clause === 'is_true' ? 'default' : 'outline'"
      @click="emit('update', 'is_true')"
      >{{ t("data.true") }}</Button
    >
    <Button
      size="sm"
      :variant="clause === 'is_false' ? 'default' : 'outline'"
      @click="emit('update', 'is_false')"
      >{{ t("data.false") }}</Button
    >
  </div>
</template>
