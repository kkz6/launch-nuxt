<script setup lang="ts">
import { Button } from '~/components/ui/button'

interface Props {
  serverId: string
  taskId: string
  commitMessage?: string
  commitSha?: string
}

const props = defineProps<Props>()

const description = computed(() => {
  const parts: string[] = []
  if (props.commitSha) {
    parts.push(props.commitSha.substring(0, 6))
  }
  if (props.commitMessage) {
    // Get first line of commit message
    const heading = props.commitMessage.split('\n')[0]
    parts.push(heading)
  }
  return parts.join(' - ')
})
</script>

<template>
  <LogsEntityLogger
    :server-id="serverId"
    entity="task"
    :entity-id="taskId"
    title="Deployment Logs"
    :description="description"
    no-timestamp
    hide-log-type-filter
  >
    <Button variant="outline" size="sm">
      <Icon name="lucide:scroll-text" class="mr-2 h-4 w-4" />
      View Logs
    </Button>
  </LogsEntityLogger>
</template>
