<script setup lang="ts">
import { Activity, Loader2 } from 'lucide-vue-next'
import { useDeploymentEvents } from '~/composables/useChannelEvents'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'

interface ActiveAction {
  id: string
  kind: string
  status: string
  label: string
  server_id: string
  project_id?: string
  target_type: 'site' | 'application' | 'compose'
  target_id: string
  task_id?: string
  started_at?: string
  created_at: string
}

const { user } = useAuth()
const { get } = useApi()
const router = useRouter()
const actions = ref<ActiveAction[]>([])
const isLoading = ref(false)
const logsOpen = ref(false)
const selected = ref<ActiveAction | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

const teamId = computed(() => String(user.value?.current_team_id || ''))
const fetchActions = async () => {
  if (!teamId.value) return
  isLoading.value = true
  try {
    const response = await get<{ data: ActiveAction[] }>('/actions/active')
    actions.value = response.data || []
  } finally {
    isLoading.value = false
  }
}

useDeploymentEvents(teamId, fetchActions)

const elapsed = (action: ActiveAction) => {
  const startedAt = new Date(action.started_at || action.created_at).getTime()
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`
}

const humanize = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

const openAction = (action: ActiveAction) => {
  selected.value = action
  if (action.task_id) {
    logsOpen.value = true
    return
  }

  const base = `/servers/${action.server_id}`
  const target =
    action.target_type === 'site'
      ? `${base}/sites/${action.target_id}?tab=deployments`
      : `${base}/projects/${action.project_id}/${action.target_type === 'application' ? 'applications' : 'composes'}/${action.target_id}?tab=deployments`
  router.push(target)
}

onMounted(() => {
  fetchActions()
  timer = setInterval(fetchActions, 10_000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        class="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Active actions"
      >
        <Activity
          class="h-4 w-4"
          :class="actions.length && 'text-primary'"
        />
        <span
          v-if="actions.length"
          class="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
          >{{ actions.length }}</span
        >
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-80 p-1">
      <DropdownMenuLabel class="flex items-center gap-2">
        <Loader2 v-if="isLoading" class="h-3.5 w-3.5 animate-spin" />
        Active actions
      </DropdownMenuLabel>
      <p
        v-if="!actions.length && !isLoading"
        class="px-2 py-5 text-center text-sm text-muted-foreground"
      >
        No actions are running.
      </p>
      <DropdownMenuItem
        v-for="action in actions"
        :key="action.id"
        class="cursor-pointer items-start gap-3 rounded-md px-2 py-2"
        @click="openAction(action)"
      >
        <Loader2 class="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium">{{
            action.label
          }}</span>
          <span class="block text-xs text-muted-foreground">
            {{ humanize(action.kind) }} · {{ humanize(action.status) }} ·
            {{ elapsed(action) }}
          </span>
        </span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <Sheet v-model:open="logsOpen">
    <SheetContent
      class="!inset-y-auto !bottom-auto !right-0 !top-0 flex h-[100dvh] w-full flex-col gap-0 overflow-hidden border-l p-0 outline-none sm:!right-4 sm:!top-[8dvh] sm:h-[84dvh] sm:max-w-4xl sm:rounded-xl sm:border"
    >
      <SheetHeader
        class="shrink-0 border-b bg-background px-5 py-5 pr-12 text-left sm:px-6 sm:pr-14"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <SheetDescription class="mb-1 text-xs font-medium uppercase tracking-wider">
              Live deployment output
            </SheetDescription>
            <SheetTitle class="truncate text-lg sm:text-xl">
              {{ selected?.label }}
            </SheetTitle>
          </div>
          <span
            v-if="selected"
            class="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            <Loader2 class="h-3 w-3 animate-spin" />
            {{ humanize(selected.status) }}
          </span>
        </div>
        <div
          v-if="selected"
          class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
        >
          <span>{{ humanize(selected.kind) }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ humanize(selected.target_type) }}</span>
          <span aria-hidden="true">·</span>
          <span>Running for {{ elapsed(selected) }}</span>
        </div>
      </SheetHeader>
      <div class="flex min-h-0 flex-1 bg-zinc-950">
        <ServerLogViewer
          v-if="logsOpen && selected?.task_id"
          :server-id="selected.server_id"
          entity="task"
          :entity-id="selected.task_id"
          :no-timestamp="true"
          hide-options
          container-class-name="h-full rounded-none border-0"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>
