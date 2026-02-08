<script setup lang="ts">
import { Button } from '~/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet'

interface Props {
  serverId: string
  taskId: string
  commitMessage?: string
  commitSha?: string
}

const props = defineProps<Props>()

const isOpen = ref(false)

const description = computed(() => {
  const parts: string[] = []
  if (props.commitSha) {
    parts.push(props.commitSha.substring(0, 6))
  }
  if (props.commitMessage) {
    const heading = props.commitMessage.split('\n')[0]
    parts.push(heading)
  }
  return parts.join(' - ')
})
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetTrigger as-child>
      <Button variant="outline" size="sm">
        <Icon name="lucide:scroll-text" class="mr-2 block size-4" />
        View Logs
      </Button>
    </SheetTrigger>
    <SheetContent class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-auto w-full rounded-lg border sm:max-w-4xl flex flex-col overflow-hidden outline-none">
      <SheetHeader class="shrink-0">
        <SheetTitle>Deployment Logs</SheetTitle>
        <SheetDescription v-if="description">
          {{ description }}
        </SheetDescription>
      </SheetHeader>
      <div class="mt-4 flex-1 min-h-0 overflow-hidden">
        <ServerLogViewer
          v-if="isOpen"
          :server-id="serverId"
          entity="task"
          :entity-id="taskId"
          :no-timestamp="true"
          hide-options
          container-class-name="h-full rounded-b-lg"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>
