<script setup lang="ts">
import { Button } from '~/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import { useServerEvents } from '~/composables/useChannelEvents'
import type { Server, ProvisionStatus } from '~/types'
import { serverService } from '~/services/serverService'

interface Props {
  server: Server | null
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })

const provisionStatus = ref<ProvisionStatus | null>(null)
const isLoading = ref(false)
const showLogs = ref(false)

// Get current team for WebSocket channel
const { user } = useAuth()
const teamId = computed(() => user.value?.current_team_id?.toString() || '')

// Subscribe to server and task events for auto-refresh
const serverId = computed(() => props.server?.id || '')

const fetchProvisionStatus = async () => {
  if (!props.server) return

  isLoading.value = true
  try {
    const response = await serverService.getProvisionStatus(props.server.id)
    provisionStatus.value = response.data
  } catch {
    provisionStatus.value = null
  } finally {
    isLoading.value = false
  }
}

// Fetch status when sheet opens
watch(open, (isOpen) => {
  if (isOpen && props.server) {
    showLogs.value = false
    fetchProvisionStatus()
  }
})

// Subscribe to real-time server events
useServerEvents(teamId, (data) => {
  // Only refresh if the event is for this server and sheet is open
  if (data.server_id === serverId.value && open.value) {
    fetchProvisionStatus()
  }
})

const latestCompletedIndex = computed(() => {
  if (!provisionStatus.value?.steps) return -1
  const steps = provisionStatus.value.steps
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].status === 'completed') return i
  }
  return -1
})

const completedCount = computed(() => {
  if (!provisionStatus.value?.steps) return 0
  return provisionStatus.value.steps.filter(s => s.status === 'completed').length
})
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-auto w-full rounded-lg border sm:max-w-4xl flex flex-col overflow-hidden outline-none">
      <SheetHeader class="flex-shrink-0">
        <SheetTitle>Server Provision Status</SheetTitle>
        <SheetDescription v-if="server">
          {{ server.name }}
        </SheetDescription>
      </SheetHeader>

      <div v-if="server" class="mt-4 flex-1 min-h-0 flex flex-col">
        <!-- View Toggle -->
        <div v-if="provisionStatus?.latest_task" class="flex gap-1 mb-4 p-1 rounded-lg bg-muted w-fit">
          <button
            :class="[
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              !showLogs ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            ]"
            @click="showLogs = false"
          >
            Steps
          </button>
          <button
            :class="[
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              showLogs ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            ]"
            @click="showLogs = true"
          >
            Logs
          </button>
        </div>
        <!-- Custom Server Provision Command -->
        <div
          v-if="server.status === 'new' && server.provider === 'custom_server' && server.provision_command"
          class="space-y-4 rounded-lg border bg-muted/30 p-4"
        >
          <div>
            <h4 class="font-semibold">Provision Script</h4>
            <p class="text-sm text-muted-foreground">
              Run this script as root on your server to start the provisioning process
            </p>
          </div>
          <div class="relative flex items-start gap-2 rounded border bg-background p-3 font-mono text-sm">
            <code class="flex-1 break-all">{{ server.provision_command }}</code>
          </div>
        </div>

        <!-- Live Logs View -->
        <div v-else-if="showLogs && provisionStatus?.latest_task" class="flex-1 min-h-0 overflow-hidden rounded-lg border border-zinc-800">
          <ServerLogViewer
            :key="provisionStatus.latest_task.id"
            :server-id="server.id"
            entity="task"
            :entity-id="provisionStatus.latest_task.id"
            :no-timestamp="true"
            hide-options
            container-class-name="!border-0 !rounded-lg"
          />
        </div>

        <!-- Live Logs Loading (no task yet) -->
        <div v-else-if="showLogs && !provisionStatus?.latest_task" class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 py-12">
          <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-primary" />
          <p class="text-sm text-muted-foreground">Waiting for provision task to start...</p>
        </div>

        <!-- Steps List -->
        <div
          v-else
          class="flex-1 min-h-0 overflow-y-auto rounded-lg border bg-muted/30 p-4"
        >
          <div v-if="isLoading" class="flex h-full flex-col items-center justify-center gap-3 py-12">
            <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-primary" />
            <p class="text-sm text-muted-foreground">Loading provision status...</p>
          </div>

          <ul v-else-if="provisionStatus?.steps" role="list" class="space-y-4">
            <li
              v-for="(step, idx) in provisionStatus.steps"
              :key="step.name"
              class="relative flex gap-x-4"
            >
              <!-- Connecting line -->
              <div
                :class="[
                  idx === provisionStatus.steps.length - 1 ? 'h-6' : '-bottom-4',
                  'absolute left-0 top-0 flex w-6 justify-center'
                ]"
              >
                <div
                  :class="[
                    idx < completedCount ? 'bg-green-500' : 'bg-border',
                    'w-px h-full transition-colors duration-300'
                  ]"
                />
              </div>

              <!-- Step icon -->
              <div class="relative flex h-6 w-6 flex-none items-center justify-center bg-muted/30 z-10">
                <template v-if="step.status === 'completed'">
                  <span
                    v-if="latestCompletedIndex === idx"
                    class="absolute h-5 w-5 animate-ping rounded-full bg-green-500/40"
                  />
                  <svg class="relative h-5 w-5" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="10" class="fill-green-500" />
                    <path d="M6 10l3 3 5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                  </svg>
                </template>
                <Icon
                  v-else-if="step.status === 'current'"
                  name="lucide:loader-2"
                  class="h-5 w-5 animate-spin text-primary"
                />
                <div
                  v-else
                  class="h-2.5 w-2.5 rounded-full bg-border ring-4 ring-muted/30"
                />
              </div>

              <!-- Step description -->
              <p
                :class="[
                  'flex-auto py-0.5 text-sm leading-5',
                  step.status === 'completed'
                    ? 'text-foreground'
                    : step.status === 'current'
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground'
                ]"
              >
                {{ step.description }}
              </p>
            </li>
          </ul>

          <div v-else class="flex h-full items-center justify-center text-muted-foreground py-12">
            No status available
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
