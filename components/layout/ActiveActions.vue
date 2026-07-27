<script setup lang="ts">
import { Activity, CircleAlert, CircleCheck, Loader2 } from 'lucide-vue-next'
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
  updateActionFromEvent,
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
        <Activity class="h-4 w-4" :class="actions.length && 'text-primary'" />
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
          <span
            v-if="action.description"
            class="block truncate font-mono text-xs text-foreground/75"
          >
            {{ action.description }}
          </span>
          <span class="block text-xs text-muted-foreground">
            {{ humanizeActionValue(action.kind) }} ·
            {{ activeActionStatusLabel(action) }} ·
            {{ elapsed(action) }}
          </span>
        </span>
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
