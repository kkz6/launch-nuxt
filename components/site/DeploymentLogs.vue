<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

interface Props {
  taskId: string
  commitMessage?: string
  commitSha?: string
}

const props = defineProps<Props>()

const isOpen = ref(false)
const isLoading = ref(false)
const contents = ref('')
const lines = ref(40)

const fetchLogs = async () => {
  isLoading.value = true
  try {
    const data = await $api<{ contents: string }>(`/tasks/${props.taskId}/output`, {
      params: { lines: lines.value },
    })
    contents.value = data.contents || ''
  } catch {
    toast.error('Failed to load logs')
  } finally {
    isLoading.value = false
  }
}

const debouncedFetch = useDebounceFn(fetchLogs, 500)

watch(isOpen, (open) => {
  if (open) {
    fetchLogs()
  }
})

watch(lines, () => {
  debouncedFetch()
})

// Parse ANSI colors to HTML spans
const parsedContents = computed(() => {
  if (!contents.value) return ''
  // Basic ANSI color parsing - replace common codes with spans
  let html = contents.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Reset
    .replace(/\x1b\[0m/g, '</span>')
    // Bold
    .replace(/\x1b\[1m/g, '<span style="font-weight:bold">')
    // Colors
    .replace(/\x1b\[30m/g, '<span style="color:#000">')
    .replace(/\x1b\[31m/g, '<span style="color:#f87171">')
    .replace(/\x1b\[32m/g, '<span style="color:#4ade80">')
    .replace(/\x1b\[33m/g, '<span style="color:#facc15">')
    .replace(/\x1b\[34m/g, '<span style="color:#60a5fa">')
    .replace(/\x1b\[35m/g, '<span style="color:#c084fc">')
    .replace(/\x1b\[36m/g, '<span style="color:#22d3ee">')
    .replace(/\x1b\[37m/g, '<span style="color:#fff">')
    // Bright colors
    .replace(/\x1b\[90m/g, '<span style="color:#6b7280">')
    .replace(/\x1b\[91m/g, '<span style="color:#fca5a5">')
    .replace(/\x1b\[92m/g, '<span style="color:#86efac">')
    .replace(/\x1b\[93m/g, '<span style="color:#fde047">')
    .replace(/\x1b\[94m/g, '<span style="color:#93c5fd">')
    .replace(/\x1b\[95m/g, '<span style="color:#d8b4fe">')
    .replace(/\x1b\[96m/g, '<span style="color:#67e8f9">')
    .replace(/\x1b\[97m/g, '<span style="color:#f9fafb">')
    // Background colors
    .replace(/\x1b\[4\dm/g, '<span>')
    // Remove any remaining ANSI codes
    .replace(/\x1b\[[0-9;]*m/g, '')

  return html
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <Button variant="outline" size="sm">
        <Icon name="lucide:scroll-text" class="mr-2 h-4 w-4" />
        View Logs
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>Deployment Logs</DialogTitle>
        <DialogDescription v-if="commitMessage || commitSha">
          <span v-if="commitSha" class="font-mono">{{ commitSha }}</span>
          <span v-if="commitSha && commitMessage"> - </span>
          <span v-if="commitMessage">{{ commitMessage }}</span>
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <Label for="lines" class="shrink-0">Lines to show:</Label>
          <Input
            id="lines"
            v-model.number="lines"
            type="number"
            class="w-24"
            :min="1"
            :max="1000"
          />
          <Button variant="outline" size="sm" :disabled="isLoading" @click="fetchLogs">
            <Icon name="lucide:refresh-cw" class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
          </Button>
        </div>

        <div class="w-full rounded-lg">
          <div v-if="isLoading" class="flex items-center justify-center py-8">
            <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
            <span class="ml-2 text-muted-foreground">Loading logs...</span>
          </div>

          <div v-else-if="!contents" class="flex items-center justify-center py-8 text-muted-foreground">
            No logs available
          </div>

          <div v-else class="max-h-[60vh] overflow-auto rounded-lg bg-[#19191A] p-4 text-white">
            <pre class="w-full whitespace-pre-wrap break-words text-sm" v-html="parsedContents" />
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
