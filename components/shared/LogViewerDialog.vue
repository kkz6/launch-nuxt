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
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-7xl">
      <DialogHeader>
        <DialogTitle class="text-xl">{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-4 pt-2.5">
        <ServerLogViewer
          v-if="open"
          :server-id="serverId"
          :entity="entity"
          :entity-id="entityId"
          type-switcher
          no-timestamp
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
