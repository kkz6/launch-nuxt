<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import type { Server, ProvisionStatus } from '~/types'
import { serverService } from '~/services/serverService'
import { useServersStore } from '~/stores/useServersStore'

interface Props {
  server: Server | null
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })

// Settings live in a sheet (composable-managed) rather than a route, so we
// open the Connections tab via the shared composable. router.push to a
// non-existent /settings page used to 404.
const { open: openSettingsSheet } = useSettingsSheet()

const provisionStatus = ref<ProvisionStatus | null>(null)
const isLoading = ref(false)
const showLogs = ref(false)
const isRetrying = ref(false)

const onRetryProvision = async () => {
  if (!props.server || isRetrying.value) return
  isRetrying.value = true
  try {
    await serverService.retryProvision(props.server.id)
    toast.success('Provisioning queued — we\'ll try again now.')
    // Force a refresh so the spinner/banner reflects the new state.
    await fetchProvisionStatus(true)
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } }
    toast.error(e.data?.message || 'Couldn\'t queue the retry. Please try again.')
  } finally {
    isRetrying.value = false
  }
}

const onManageCredentials = () => {
  open.value = false
  openSettingsSheet('connections')
}

// Watch the store's entry for this server. Whenever the store applies
// a WS event to it (server.updated / provision_progress / etc.), this
// component refetches its detailed provision status. We don't subscribe
// to WS events directly — that's the store's job. This kept the
// previous "n components, n subscriptions" anti-pattern from sneaking
// back in.
const serversStore = useServersStore()
const serverId = computed(() => props.server?.id || '')
const storeServer = computed(() => {
  if (!serverId.value) return undefined
  return serversStore.servers.find(s => s.id === serverId.value)
})

const fetchProvisionStatus = async (silent = false) => {
  if (!props.server) return

  if (!silent) isLoading.value = true
  try {
    const response = await serverService.getProvisionStatus(props.server.id)
    // Always replace the whole object — Vue's keyed v-for diff
    // (`:key="step.name"`) means changed steps animate cleanly and
    // unchanged ones aren't re-rendered. The previous "merge in-place"
    // optimization was the source of a stale-UI bug: it Object.assign'd
    // each step but skipped the top-level fields (failed, error_message,
    // current_step), so socket events would update steps while leaving
    // the rest of the response stale. Reproduction: backend broadcasts
    // server.provision_step events as the script progresses; UI stays
    // stuck on the first step until a full page reload.
    provisionStatus.value = response.data
  } catch {
    if (!silent) provisionStatus.value = null
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

// Debounced silent refetch when the store's server entry changes while
// the sheet is open. The store's WS subscription mutates the entry
// (status, progress, etc.); we react by pulling the detailed provision
// status which lives on a different endpoint.
//
// IMPORTANT: We watch a *tuple of primitive values* rather than the
// reactive object itself. Vue 3 passes the same reference for `next`
// and `prev` when an object is mutated in place (which is exactly what
// the store's `patch()` does) — so a `watch(storeServer, …, { deep: true })`
// gets `next.progress === prev.progress` even after the value changed,
// and the refetch never fires. Watching a getter that returns a fresh
// array each time gives us proper snapshot semantics.
let statusFetchTimeout: ReturnType<typeof setTimeout> | null = null

watch(
  () => [
    storeServer.value?.status,
    storeServer.value?.progress,
    storeServer.value?.connected,
  ] as const,
  ([nextStatus, nextProgress, nextConnected], [prevStatus, prevProgress, prevConnected]) => {
    if (!open.value || !storeServer.value) return
    if (
      nextStatus === prevStatus
      && nextProgress === prevProgress
      && nextConnected === prevConnected
    ) return

    if (statusFetchTimeout) clearTimeout(statusFetchTimeout)
    statusFetchTimeout = setTimeout(() => fetchProvisionStatus(true), 300)
  },
)

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

const totalSteps = computed(() => provisionStatus.value?.steps?.length ?? 0)

const progressPercent = computed(() => {
  if (totalSteps.value === 0) return 0
  return Math.round((completedCount.value / totalSteps.value) * 100)
})

const currentStepLabel = computed(() => {
  const step = provisionStatus.value?.steps?.find(s => s.status === 'current')
  return step?.description ?? ''
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
        <!-- Failed banner: shown when the backend flagged the server as
             failed. Designed to look like a polished SaaS error state, not
             a stack trace. Copy comes from server.provision_error which is
             classified server-side (providers.FriendlyError) so it never
             leaks raw upstream payloads. -->
        <div
          v-if="provisionStatus?.failed"
          class="mb-4 flex-shrink-0 overflow-hidden rounded-xl border border-destructive/30 bg-gradient-to-b from-destructive/[0.06] to-transparent"
        >
          <div class="flex items-start gap-4 p-5">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <Icon name="lucide:circle-x" class="h-5 w-5 text-destructive" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-semibold text-foreground">
                We couldn't provision this server
              </h3>
              <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
                {{ provisionStatus.error_message }}
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="default"
                  :disabled="isRetrying"
                  @click="onRetryProvision"
                >
                  <Icon
                    v-if="isRetrying"
                    name="lucide:loader-2"
                    class="mr-1.5 h-3.5 w-3.5 animate-spin"
                  />
                  <Icon
                    v-else
                    name="lucide:refresh-cw"
                    class="mr-1.5 h-3.5 w-3.5"
                  />
                  Try again
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  @click="onManageCredentials"
                >
                  <Icon name="lucide:key-round" class="mr-1.5 h-3.5 w-3.5" />
                  Manage credentials
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Header strip: tabs + progress meta -->
        <div
          v-if="provisionStatus?.latest_task && !provisionStatus?.failed"
          class="mb-4 flex flex-shrink-0 flex-wrap items-center justify-between gap-3"
        >
          <!-- Segmented tabs -->
          <div class="inline-flex gap-1 p-1 rounded-lg bg-muted">
            <button
              :class="[
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                !showLogs
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
              @click="showLogs = false"
            >
              <Icon name="lucide:list-checks" class="h-3.5 w-3.5" />
              Steps
            </button>
            <button
              :class="[
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                showLogs
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
              @click="showLogs = true"
            >
              <Icon name="lucide:terminal" class="h-3.5 w-3.5" />
              Logs
            </button>
          </div>

          <!-- Progress meta -->
          <div class="flex items-center gap-3 text-xs text-muted-foreground">
            <div class="flex items-center gap-1.5">
              <span class="relative flex h-2 w-2">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span class="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span class="font-medium text-foreground">{{ completedCount }}/{{ totalSteps }}</span>
              <span>steps</span>
            </div>
            <div class="h-3 w-px bg-border" />
            <span class="font-medium text-foreground">{{ progressPercent }}%</span>
          </div>
        </div>

        <!-- Slim progress bar -->
        <div
          v-if="provisionStatus?.latest_task && !provisionStatus?.failed"
          class="mb-4 flex-shrink-0 h-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            class="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-700 ease-out"
            :style="{ width: `${progressPercent}%` }"
          />
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

        <!-- Live Logs View — terminal-style frame.
             The wrapper needs `flex flex-col` so the ServerLogViewer's
             internal `flex-1 min-h-0` chain can stretch the scroll area
             to fill the sheet. Without it, the terminal renders at
             intrinsic content height with empty space below. -->
        <div
          v-else-if="showLogs && provisionStatus?.latest_task"
          class="flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
        >
          <!-- Terminal title bar -->
          <div class="flex flex-shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <div class="flex items-center gap-2 min-w-0">
              <Icon name="lucide:terminal" class="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
              <span class="truncate font-mono text-xs text-zinc-400">
                {{ currentStepLabel || 'provision.log' }}
              </span>
            </div>
            <div class="flex flex-shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>
          <ServerLogViewer
            :key="provisionStatus.latest_task.id"
            :server-id="server.id"
            entity="task"
            :entity-id="provisionStatus.latest_task.id"
            :no-timestamp="true"
            hide-options
            container-class-name="!border-0 !rounded-none !bg-transparent"
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

          <!-- Adjacent rows must touch (space-y-0) so the upper/lower line
               segments meet at the row boundary, giving a single continuous
               connector. Each row contributes a top-half segment (from row
               top to icon center) and a bottom-half segment (from icon center
               to row bottom); the icon's solid bg-background masks the part
               that crosses the icon, so the line visually starts/stops at
               the icon's edge. -->
          <ul v-else-if="provisionStatus?.steps" role="list" class="space-y-0">
            <li
              v-for="(step, idx) in provisionStatus.steps"
              :key="step.name"
              :class="[
                'relative flex items-center gap-x-4 rounded-md px-2 py-3 transition-colors',
                step.status === 'current' ? 'bg-primary/5' : ''
              ]"
            >
              <!-- Upper-half connector: row top → icon center.
                   Colored by the segment's owner (previous step). -->
              <div
                v-if="idx > 0"
                aria-hidden="true"
                :class="[
                  'absolute left-[20px] top-0 bottom-1/2 w-px transition-colors duration-300',
                  provisionStatus.steps[idx - 1].status === 'completed'
                    ? 'bg-green-500/60'
                    : 'bg-border'
                ]"
              />
              <!-- Lower-half connector: icon center → row bottom.
                   Colored by this step's own completion. -->
              <div
                v-if="idx < provisionStatus.steps.length - 1"
                aria-hidden="true"
                :class="[
                  'absolute left-[20px] top-1/2 bottom-0 w-px transition-colors duration-300',
                  step.status === 'completed' ? 'bg-green-500/60' : 'bg-border'
                ]"
              />

              <!-- Step icon.
                   `bg-background` is required and intentional — it gives the
                   icon a solid disc that masks the connector behind it. With
                   any semi-transparent bg (e.g. bg-muted/30) the line shows
                   through the loader's gaps, which was the original bug. -->
              <div class="relative flex h-6 w-6 flex-none items-center justify-center z-10 rounded-full bg-background">
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
                  class="h-2.5 w-2.5 rounded-full bg-border"
                />
              </div>

              <!-- Step description -->
              <div class="flex-1 min-w-0">
                <p
                  :class="[
                    'text-sm leading-5 transition-colors duration-300',
                    step.status === 'completed'
                      ? 'text-foreground'
                      : step.status === 'current'
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground'
                  ]"
                >
                  {{ step.description }}
                </p>
              </div>

              <!-- Trailing status pill (only for current) -->
              <span
                v-if="step.status === 'current'"
                class="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary"
              >
                In progress
              </span>
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
