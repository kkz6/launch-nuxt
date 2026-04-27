<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { serverService } from '~/services/serverService'
import type { DockerServiceKind } from '~/types'

interface Props {
  serverId: string
  kind: DockerServiceKind
  kindLabel: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { default: false })

const tail = ref(200)
const output = ref('')
const isLoading = ref(false)

const fetchLogs = async () => {
  isLoading.value = true
  try {
    const res = await serverService.dockerServices.logs(
      props.serverId,
      props.kind,
      tail.value,
    )
    output.value = res.data?.output ?? ''
  } catch {
    toast.error('Failed to fetch logs')
  } finally {
    isLoading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    fetchLogs()
  } else {
    output.value = ''
  }
})

const tailOptions = [100, 200, 500, 1000, 2000]
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex h-[80vh] flex-col overflow-hidden sm:max-w-5xl">
      <DialogHeader class="shrink-0">
        <DialogTitle>{{ kindLabel }} logs</DialogTitle>
        <DialogDescription>
          Last {{ tail }} lines from <code>docker logs</code>.
        </DialogDescription>
      </DialogHeader>

      <div class="flex shrink-0 items-center gap-2 pt-2">
        <select
          v-model.number="tail"
          class="rounded-md border bg-background px-2 py-1 text-sm"
          @change="fetchLogs"
        >
          <option v-for="n in tailOptions" :key="n" :value="n">{{ n }} lines</option>
        </select>
        <Button variant="outline" size="sm" :disabled="isLoading" @click="fetchLogs">
          <Icon
            :name="isLoading ? 'lucide:loader-2' : 'lucide:refresh-cw'"
            :class="['mr-2 h-4 w-4', isLoading && 'animate-spin']"
          />
          Refresh
        </Button>
      </div>

      <pre
        class="mt-2 flex-1 overflow-auto rounded-md bg-muted p-3 text-xs leading-5"
      ><code>{{ output || (isLoading ? 'Loading…' : 'No output') }}</code></pre>
    </DialogContent>
  </Dialog>
</template>
