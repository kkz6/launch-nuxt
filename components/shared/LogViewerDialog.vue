<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

interface Props {
  serverId: string
  entity: string
  entityId: string
  title: string
  description?: string
}

defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="h-[85vh] sm:max-w-7xl flex flex-col overflow-hidden">
      <DialogHeader class="shrink-0">
        <DialogTitle class="text-xl">{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>
      <div class="flex flex-col flex-1 min-h-0 pt-2.5">
        <ServerLogViewer
          v-if="open"
          :server-id="serverId"
          :entity="entity"
          :entity-id="entityId"
          type-switcher
          no-timestamp
          container-class-name="h-full"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
