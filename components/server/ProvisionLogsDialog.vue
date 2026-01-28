<script setup lang="ts">
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import type { Server } from '~/types'

interface Props {
  server: Server | null
}

defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })

const getStatusMessage = (status: string): string => {
  switch (status) {
    case 'new':
      return 'Server created. Waiting for provisioning to start...'
    case 'starting':
      return 'Attempting to connect to server via SSH...'
    case 'provisioning':
      return 'Server is being provisioned. Installing packages and configuring services...'
    case 'failed':
      return 'Provisioning failed. Check the logs below for details.'
    case 'running':
      return 'Server is running and fully provisioned.'
    default:
      return 'Unknown status'
  }
}

const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'new':
    case 'starting':
      return 'lucide:clock'
    case 'provisioning':
      return 'lucide:loader-2'
    case 'failed':
      return 'lucide:alert-circle'
    case 'running':
      return 'lucide:check-circle'
    default:
      return 'lucide:help-circle'
  }
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'new':
    case 'starting':
    case 'provisioning':
      return 'text-yellow-500'
    case 'failed':
      return 'text-destructive'
    case 'running':
      return 'text-green-500'
    default:
      return 'text-muted-foreground'
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="lucide:scroll-text" class="h-5 w-5" />
          Provision Status
        </DialogTitle>
        <DialogDescription v-if="server">
          Status for {{ server.name }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="server" class="space-y-4">
        <!-- Current Status -->
        <div class="flex items-start gap-3 rounded-lg border p-4">
          <Icon
            :name="getStatusIcon(server.status)"
            :class="[
              'mt-0.5 h-5 w-5',
              getStatusColor(server.status),
              server.status === 'provisioning' ? 'animate-spin' : ''
            ]"
          />
          <div class="flex-1">
            <p class="font-medium">{{ server.status_label || server.status }}</p>
            <p class="text-sm text-muted-foreground">
              {{ getStatusMessage(server.status) }}
            </p>
          </div>
        </div>

        <!-- Progress (if provisioning) -->
        <div v-if="server.status === 'provisioning' && server.progress" class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span>Progress</span>
            <span>{{ server.progress }}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full bg-primary transition-all"
              :style="{ width: `${server.progress}%` }"
            />
          </div>
          <p v-if="server.progress_step" class="text-sm text-muted-foreground">
            {{ server.progress_step }}
          </p>
        </div>

        <!-- Logs placeholder -->
        <div class="rounded-lg border bg-muted/50 p-4">
          <p class="text-center text-sm text-muted-foreground">
            <Icon name="lucide:terminal" class="mr-1 inline h-4 w-4" />
            Real-time logs will be available here once WebSocket streaming is implemented.
          </p>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="open = false">
            Close
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
