<script setup lang="ts">
import { Activity, CircleAlert, CircleCheck, Loader2, X } from 'lucide-vue-next'
import {
  useCommandEvents,
  useDeploymentEvents,
  useTaskEvents,
} from '~/composables/useChannelEvents'
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
import {
  activeActionPath,
  activeActionStatusLabel,
  activeActionStatusTone,
  humanizeActionValue,
  isActiveActionRunning,
  pruneDismissedIds,
  updateActionFromEvent,
  visibleActiveActions,
  type ActiveAction,
} from '~/utils/activeActions'

const { user } = useAuth()
const { get } = useApi()
const router = useRouter()
const actions = ref<ActiveAction[]>([])
const isLoading = ref(false)
const logsOpen = ref(false)
const selected = ref<ActiveAction | null>(null)
let timer: ReturnType<typeof setInterval> | null = null
let fetchSequence = 0

// Terminal actions linger server-side so a failure is still readable after
// it finishes. They are not work in progress though, so let the user clear
// them, and remember that across reloads — the row would otherwise reappear
// on the next poll for as long as the backend retains it.
const DISMISSED_KEY = 'launch:dismissed-actions'
const dismissed = ref<string[]>([])

const loadDismissed = () => {
  if (!import.meta.client) return
  try {
    const stored = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')
    dismissed.value = Array.isArray(stored) ? stored.map(String) : []
  } catch {
    dismissed.value = []
  }
}

const dismiss = (action: ActiveAction) => {
  dismissed.value = [...new Set([...dismissed.value, action.id])]
  if (import.meta.client) {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed.value))
  }
}

// Only keep ids we could still receive, so the list cannot grow forever.
const pruneDismissed = (current: ActiveAction[]) => {
  const kept = pruneDismissedIds(dismissed.value, current)
  if (kept.length === dismissed.value.length) return
  dismissed.value = kept
  if (import.meta.client) {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(kept))
  }
}

const visibleActions = computed(() =>
  visibleActiveActions(actions.value, dismissed.value),
)
const failedActions = computed(() =>
  visibleActions.value.filter(
    (action) => activeActionStatusTone(action.status) === 'failure',
  ),
)

const teamId = computed(() => String(user.value?.current_team_id || ''))
const fetchActions = async () => {
  if (!teamId.value) return
  const sequence = ++fetchSequence
  isLoading.value = true
  try {
    const response = await get<{ data: ActiveAction[] }>('/actions/active')
    if (sequence !== fetchSequence) return

    const nextActions = response.data || []
    actions.value = nextActions
    pruneDismissed(nextActions)

    const refreshedSelection = nextActions.find(
      (action) => action.id === selected.value?.id,
    )
    if (
      refreshedSelection &&
      selected.value &&
      isActiveActionRunning(selected.value)
    ) {
      selected.value = refreshedSelection
    }
  } finally {
    if (sequence === fetchSequence) {
      isLoading.value = false
    }
  }
}

useDeploymentEvents(teamId, async (data, event) => {
  selected.value = updateActionFromEvent(selected.value, data, event)
  await fetchActions()
})

useCommandEvents(teamId, fetchActions)

useTaskEvents(teamId, async (data, event) => {
  selected.value = updateActionFromEvent(selected.value, data, event)
  await fetchActions()
})

const elapsed = (action: ActiveAction) => {
  const startedAt = new Date(action.started_at || action.created_at).getTime()
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`
}

const actionStateDescription = (action: ActiveAction) => {
  if (isActiveActionRunning(action)) return `Running for ${elapsed(action)}`

  const tone = activeActionStatusTone(action.status)
  if (tone === 'success') return `${humanizeActionValue(action.kind)} complete`
  if (tone === 'failure') return activeActionStatusLabel(action)
  return humanizeActionValue(action.status)
}

const actionOutputContextLabel = (action: ActiveAction | null) => {
  if (!action) return 'Live output'

  const phase = isActiveActionRunning(action) ? 'Live' : 'Final'
  return `${phase} ${humanizeActionValue(action.kind).toLowerCase()} output`
}

const outputModeLabel = (action: ActiveAction) =>
  isActiveActionRunning(action) ? 'Live output' : 'Final output'

const openAction = (action: ActiveAction) => {
  selected.value = action
  if (action.task_id) {
    logsOpen.value = true
    return
  }

  router.push(activeActionPath(action))
}

onMounted(() => {
  loadDismissed()
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
          :class="
            failedActions.length
              ? 'text-destructive'
              : visibleActions.length
                ? 'text-primary'
                : undefined
          "
        />
        <span
          v-if="visibleActions.length"
          class="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold"
          :class="
            failedActions.length
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-primary text-primary-foreground'
          "
          >{{ visibleActions.length }}</span
        >
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-80 p-1">
      <DropdownMenuLabel class="flex items-center gap-2">
        <Loader2 v-if="isLoading" class="h-3.5 w-3.5 animate-spin" />
        Active actions
      </DropdownMenuLabel>
      <p
        v-if="!visibleActions.length && !isLoading"
        class="px-2 py-5 text-center text-sm text-muted-foreground"
      >
        No actions are running.
      </p>
      <DropdownMenuItem
        v-for="action in visibleActions"
        :key="action.id"
        class="group cursor-pointer items-start gap-3 rounded-md px-2 py-2"
        @click="openAction(action)"
      >
        <Loader2
          v-if="isActiveActionRunning(action)"
          class="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary"
        />
        <CircleAlert
          v-else-if="activeActionStatusTone(action.status) === 'failure'"
          class="mt-0.5 h-4 w-4 shrink-0 text-destructive"
        />
        <CircleCheck v-else class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium">{{
            action.label
          }}</span>
          <span
            v-if="action.description"
            class="block truncate font-mono text-xs text-foreground/75"
          >
            {{ action.description }}
          </span>
          <span
            class="block text-xs"
            :class="
              activeActionStatusTone(action.status) === 'failure'
                ? 'text-destructive'
                : 'text-muted-foreground'
            "
          >
            {{ humanizeActionValue(action.kind) }} ·
            {{ activeActionStatusLabel(action) }} ·
            {{ elapsed(action) }}
          </span>
        </span>
        <button
          v-if="!isActiveActionRunning(action)"
          type="button"
          class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
          :aria-label="`Dismiss ${action.label}`"
          @click.stop="dismiss(action)"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <Sheet v-model:open="logsOpen">
    <SheetContent
      class="inset-y-0 right-0 flex h-[100dvh] w-full flex-col gap-0 overflow-hidden border-0 bg-[#0b0c0e] p-0 shadow-none outline-none sm:max-w-5xl [&>button]:right-5 [&>button]:top-5 [&>button]:grid [&>button]:h-8 [&>button]:w-8 [&>button]:place-items-center [&>button]:rounded-lg [&>button]:ring-offset-0 [&>button]:transition-colors hover:[&>button]:bg-muted"
    >
      <SheetHeader
        class="relative z-10 shrink-0 gap-y-0 border-b border-border/60 bg-background px-5 pb-5 pt-4 pr-14 text-left sm:px-7 sm:pb-6 sm:pt-5 sm:pr-16"
      >
        <SheetDescription
          class="flex items-center gap-2 text-xs font-medium text-muted-foreground"
        >
          <span
            class="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
            :class="{
              'animate-pulse bg-emerald-500':
                selected && isActiveActionRunning(selected),
              'bg-emerald-500':
                selected &&
                activeActionStatusTone(selected.status) === 'success',
              'bg-red-500':
                selected &&
                activeActionStatusTone(selected.status) === 'failure',
            }"
            aria-hidden="true"
          />
          {{ actionOutputContextLabel(selected) }}
        </SheetDescription>
        <div class="mt-2 flex min-w-0 flex-wrap items-center gap-3">
          <SheetTitle
            class="truncate text-xl font-semibold tracking-[-0.025em] sm:text-2xl"
          >
            {{ selected?.label }}
          </SheetTitle>
          <span
            v-if="selected"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-50 shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
            :class="{
              'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white':
                activeActionStatusTone(selected.status) === 'success',
              'bg-red-600 text-white dark:bg-red-500 dark:text-white':
                activeActionStatusTone(selected.status) === 'failure',
            }"
          >
            <Loader2
              v-if="activeActionStatusTone(selected.status) === 'running'"
              class="h-3 w-3 animate-spin"
            />
            <CircleCheck
              v-else-if="activeActionStatusTone(selected.status) === 'success'"
              class="h-3.5 w-3.5"
            />
            <CircleAlert
              v-else-if="activeActionStatusTone(selected.status) === 'failure'"
              class="h-3.5 w-3.5"
            />
            {{ activeActionStatusLabel(selected) }}
          </span>
        </div>
        <div
          v-if="selected"
          class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground"
        >
          <span class="font-medium text-foreground/70">{{
            humanizeActionValue(selected.kind)
          }}</span>
          <span class="h-3 w-px bg-border" aria-hidden="true" />
          <span>{{ humanizeActionValue(selected.target_type) }}</span>
          <span class="h-3 w-px bg-border" aria-hidden="true" />
          <span>{{ actionStateDescription(selected) }}</span>
        </div>
      </SheetHeader>
      <section class="flex min-h-0 flex-1 flex-col bg-[#0b0c0e]">
        <div
          class="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] px-5 text-[11px] text-zinc-500 sm:px-7"
        >
          <span class="font-mono">Task output</span>
          <span
            v-if="selected"
            class="inline-flex items-center gap-2 transition-colors duration-200"
            :class="{
              'font-medium text-emerald-400': isActiveActionRunning(selected),
            }"
          >
            <span
              class="h-1.5 w-1.5 rounded-full bg-zinc-600"
              :class="{
                'animate-pulse bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] ring-4 ring-emerald-400/10':
                  isActiveActionRunning(selected),
              }"
              aria-hidden="true"
            />
            {{ outputModeLabel(selected) }}
          </span>
        </div>
        <div class="flex min-h-0 flex-1">
          <ServerLogViewer
            v-if="logsOpen && selected?.task_id"
            :server-id="selected.server_id"
            entity="task"
            :entity-id="selected.task_id"
            :no-timestamp="true"
            hide-options
            container-class-name="h-full rounded-none border-0 bg-[#0b0c0e] px-5 py-4 sm:px-7 sm:py-5"
          />
        </div>
      </section>
    </SheetContent>
  </Sheet>
</template>
