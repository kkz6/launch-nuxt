<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'

interface Props {
  date: string | Date
  format?: 'relative' | 'full' | 'date' | 'time'
}

const props = withDefaults(defineProps<Props>(), {
  format: 'relative',
})

const formattedDate = computed(() => {
  const d = new Date(props.date)

  if (props.format === 'full') {
    return d.toLocaleString()
  }
  if (props.format === 'date') {
    return d.toLocaleDateString()
  }
  if (props.format === 'time') {
    return d.toLocaleTimeString()
  }

  // Relative format
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return d.toLocaleDateString()
})

const fullDate = computed(() => new Date(props.date).toLocaleString())
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <span class="cursor-help">
          <slot>{{ formattedDate }}</slot>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{{ fullDate }}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
