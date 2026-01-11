<script setup lang="ts">
import { Button } from "~/components/ui/button";

const emit = defineEmits<{
  created: [];
}>();

// This is a placeholder - implement the full dialog based on your API
const handleClick = () => {
  // TODO: Implement server provider connection dialog
  console.log("Add server provider clicked");
};
</script>

<template>
  <Button @click="handleClick">
    <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
    Add Provider
  </Button>
</template>
