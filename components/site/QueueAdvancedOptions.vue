<script setup lang="ts">
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'
import { Label } from '~/components/ui/label'

interface QueueValues {
  queue_connection: string
  queue: string
  user?: string
  max_seconds_per_job: number
  rest_seconds_on_empty: number
  failed_job_delay_seconds: number
  directory?: string
  run_on_maintenance: boolean
  run_with_listen: boolean
  environment?: string
  max_tries?: number
  max_memory?: number
  numprocs?: number
  stop_wait_seconds?: number
}

const open = defineModel<boolean>('open', { required: true })
const values = defineModel<QueueValues>('values', { required: true })

const updateValue = <K extends keyof QueueValues>(key: K, value: QueueValues[K]) => {
  values.value = { ...values.value, [key]: value }
}

const runWithListen = computed({
  get: () => Boolean(values.value.run_with_listen),
  set: (val: boolean) => updateValue('run_with_listen', val),
})

const runOnMaintenance = computed({
  get: () => Boolean(values.value.run_on_maintenance),
  set: (val: boolean) => updateValue('run_on_maintenance', val),
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Advanced Options</DialogTitle>
        <DialogDescription>
          Configure advanced queue worker settings
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-6 py-4">
        <!-- Policies Section -->
        <div class="space-y-4 border-b pb-4">
          <h3 class="text-sm font-medium">Policies</h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Max Seconds Per Job</Label>
              <Input
                type="number"
                :model-value="values.max_seconds_per_job"
                @update:model-value="updateValue('max_seconds_per_job', Number($event))"
              />
              <p class="text-xs text-muted-foreground">Maximum time a job can run</p>
            </div>

            <div class="space-y-2">
              <Label>Rest Seconds on Empty</Label>
              <Input
                type="number"
                placeholder="3"
                :model-value="values.rest_seconds_on_empty"
                @update:model-value="updateValue('rest_seconds_on_empty', Number($event))"
              />
            </div>

            <div class="space-y-2">
              <Label>Failed Job Delay Seconds</Label>
              <Input
                type="number"
                placeholder="0"
                :model-value="values.failed_job_delay_seconds"
                @update:model-value="updateValue('failed_job_delay_seconds', Number($event))"
              />
            </div>

            <div class="space-y-2">
              <Label>Max Tries</Label>
              <Input
                type="number"
                :model-value="values.max_tries"
                @update:model-value="updateValue('max_tries', $event ? Number($event) : undefined)"
              />
            </div>
          </div>
        </div>

        <!-- Configuration Section -->
        <div class="space-y-4">
          <h3 class="text-sm font-medium">Configuration</h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Environment</Label>
              <Input
                placeholder="production"
                :model-value="values.environment"
                @update:model-value="updateValue('environment', $event ? String($event) : undefined)"
              />
            </div>

            <div class="space-y-2">
              <Label>Max Memory (MB)</Label>
              <Input
                type="number"
                placeholder="128"
                :model-value="values.max_memory"
                @update:model-value="updateValue('max_memory', $event ? Number($event) : undefined)"
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label>Working Directory</Label>
            <Input
              placeholder="/home/user/site.com"
              :model-value="values.directory"
              @update:model-value="updateValue('directory', $event ? String($event) : undefined)"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Number of Processes</Label>
              <Input
                type="number"
                :model-value="values.numprocs"
                @update:model-value="updateValue('numprocs', $event ? Number($event) : undefined)"
              />
            </div>

            <div class="space-y-2">
              <Label>Graceful Shutdown (seconds)</Label>
              <Input
                type="number"
                placeholder="10"
                :model-value="values.stop_wait_seconds"
                @update:model-value="updateValue('stop_wait_seconds', $event ? Number($event) : undefined)"
              />
            </div>
          </div>

          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <Label>Run with Listen</Label>
              <p class="text-sm text-muted-foreground">Use queue:listen instead of queue:work</p>
            </div>
            <Switch v-model="runWithListen" />
          </div>

          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <Label>Run on Maintenance</Label>
              <p class="text-sm text-muted-foreground">Keep running when application is in maintenance mode</p>
            </div>
            <Switch v-model="runOnMaintenance" />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
