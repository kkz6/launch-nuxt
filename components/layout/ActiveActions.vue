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
      class="inset-y-0 right-0 flex h-[100dvh] w-full flex-col gap-0 overflow-hidden border-0 bg-background p-0 shadow-none outline-none sm:max-w-4xl sm:border-l sm:border-border/70 sm:shadow-[-18px_0_45px_-30px_rgba(15,23,42,0.4)]"
    >
      <SheetHeader
        class="shrink-0 gap-y-0 border-b border-border/70 bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:py-5 sm:pr-14"
      >
        <SheetDescription
          class="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          Active deployment
        </SheetDescription>
        <div class="mt-1.5 flex min-w-0 flex-wrap items-center gap-2.5">
          <SheetTitle class="truncate text-lg tracking-tight sm:text-xl">
            {{ selected?.label }}
          </SheetTitle>
          <span
            v-if="selected"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/70 bg-muted/50 px-2 py-1 text-xs font-medium text-foreground"
          >
            <Loader2 class="h-3 w-3 animate-spin text-muted-foreground" />
            {{ humanize(selected.status) }}
          </span>
        </div>
        <div
          v-if="selected"
          class="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
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
