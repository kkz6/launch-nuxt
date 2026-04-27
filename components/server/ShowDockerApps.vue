<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { useDockerAppEvents } from '~/composables/useChannelEvents'
import { dockerAppService } from '~/services/dockerAppService'
import type { DockerApp, Server } from '~/types'

interface Props {
  server: Server
}

const props = defineProps<Props>()
const serverId = computed(() => props.server.id)

const apps = ref<DockerApp[]>([])
const isLoading = ref(true)
const busyAction = ref<Record<string, string | null>>({})
const installDialogOpen = ref(false)

const confirmationDialog = ref<
  InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null
>(null)

const statusVariant = (status: DockerApp['status']) => {
  switch (status) {
    case 'running':
      return 'success'
    case 'stopped':
      return 'secondary'
    case 'failed':
      return 'destructive'
    case 'deploying':
    case 'pending':
    default:
      return 'outline'
  }
}

const isBusy = (app: DockerApp) =>
  app.status === 'deploying' || app.status === 'pending'

const setAction = (id: string, action: string | null) => {
  busyAction.value = { ...busyAction.value, [id]: action }
}

const fetchData = async () => {
  try {
    const res = await dockerAppService.list(serverId.value)
    apps.value = res.data ?? []
  } catch {
    toast.error('Failed to load applications')
  } finally {
    isLoading.value = false
  }
}

const deploy = async (app: DockerApp) => {
  setAction(app.id, 'deploy')
  try {
    await dockerAppService.deploy(serverId.value, app.id)
    toast.success(`${app.name} redeploy started`)
    fetchData()
  } catch {
    toast.error(`Failed to redeploy ${app.name}`)
    setAction(app.id, null)
  }
}

const start = async (app: DockerApp) => {
  setAction(app.id, 'start')
  try {
    await dockerAppService.start(serverId.value, app.id)
    toast.success(`${app.name} started`)
    fetchData()
  } catch {
    toast.error(`Failed to start ${app.name}`)
  } finally {
    setAction(app.id, null)
  }
}

const stop = async (app: DockerApp) => {
  setAction(app.id, 'stop')
  try {
    await dockerAppService.stop(serverId.value, app.id)
    toast.success(`${app.name} stopped`)
    fetchData()
  } catch {
    toast.error(`Failed to stop ${app.name}`)
  } finally {
    setAction(app.id, null)
  }
}

const restart = async (app: DockerApp) => {
  setAction(app.id, 'restart')
  try {
    await dockerAppService.restart(serverId.value, app.id)
    toast.success(`${app.name} restarted`)
    fetchData()
  } catch {
    toast.error(`Failed to restart ${app.name}`)
  } finally {
    setAction(app.id, null)
  }
}

const uninstall = async (app: DockerApp) => {
  if (!confirmationDialog.value) return
  const result = await confirmationDialog.value.show({
    title: `Uninstall ${app.name}?`,
    description: 'The container will be removed. Volumes are kept by default; check the box below to drop them.',
    confirmText: 'Uninstall',
    cancelText: 'Cancel',
    destructive: true,
    inputVerificationText: app.name,
    helpText: 'Type the application name to confirm:',
    checkbox: {
      label: 'Also delete the named volumes (irreversible)',
      checked: false,
    },
  })
  if (!result.ok) return

  const removeData = result.checkbox?.checked === true
  setAction(app.id, 'uninstall')
  try {
    await dockerAppService.uninstall(serverId.value, app.id, removeData)
    toast.success(`${app.name} uninstall started`)
    fetchData()
  } catch {
    toast.error(`Failed to uninstall ${app.name}`)
    setAction(app.id, null)
  }
}

// Live updates --------------------------------------------------------
const { user } = useAuth()
const teamId = computed(() => user.value?.current_team_id?.toString() || '')
let refetchTimer: ReturnType<typeof setTimeout> | null = null

useDockerAppEvents(teamId, (data) => {
  if (data.server_id !== serverId.value) return
  if (refetchTimer) clearTimeout(refetchTimer)
  refetchTimer = setTimeout(() => {
    fetchData()
    busyAction.value = {}
  }, 250)
})

onMounted(fetchData)
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <ServerCreateDockerApp
      v-model:open="installDialogOpen"
      :server-id="serverId"
      @created="fetchData"
    />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">Applications</h3>
        <p class="text-sm text-muted-foreground">
          Containerised applications on this server. Each app runs as a single container on launch-network.
        </p>
      </div>
      <Button size="sm" @click="installDialogOpen = true">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Add application
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="apps.length === 0" class="rounded-lg border p-8 text-center">
      <Icon name="lucide:container" class="mx-auto h-10 w-10 text-muted-foreground" />
      <p class="mt-2 text-sm text-muted-foreground">No applications deployed yet.</p>
      <Button class="mt-4" size="sm" @click="installDialogOpen = true">
        Deploy your first application
      </Button>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="app in apps"
        :key="app.id"
        class="rounded-lg border p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <Icon name="lucide:container" class="h-5 w-5 text-muted-foreground" />
              <span class="text-sm font-semibold">{{ app.name }}</span>
              <Badge :variant="statusVariant(app.status)">{{ app.status_label }}</Badge>
            </div>
            <p class="mt-1 truncate font-mono text-xs text-muted-foreground">
              {{ app.image_ref }}
            </p>
            <p
              v-if="app.last_error"
              class="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive"
            >
              {{ app.last_error }}
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              :disabled="!!busyAction[app.id] || isBusy(app)"
              @click="deploy(app)"
            >
              <Icon
                :name="busyAction[app.id] === 'deploy' ? 'lucide:loader-2' : 'lucide:rocket'"
                :class="['mr-1 h-3.5 w-3.5', busyAction[app.id] === 'deploy' && 'animate-spin']"
              />
              Redeploy
            </Button>
            <Button
              v-if="app.status === 'stopped'"
              size="sm"
              variant="outline"
              :disabled="!!busyAction[app.id] || isBusy(app)"
              @click="start(app)"
            >
              <Icon name="lucide:play" class="mr-1 h-3.5 w-3.5" />
              Start
            </Button>
            <Button
              v-if="app.status === 'running'"
              size="sm"
              variant="outline"
              :disabled="!!busyAction[app.id] || isBusy(app)"
              @click="stop(app)"
            >
              <Icon name="lucide:pause" class="mr-1 h-3.5 w-3.5" />
              Stop
            </Button>
            <Button
              v-if="app.status === 'running' || app.status === 'stopped'"
              size="sm"
              variant="outline"
              :disabled="!!busyAction[app.id] || isBusy(app)"
              @click="restart(app)"
            >
              <Icon name="lucide:rotate-ccw" class="mr-1 h-3.5 w-3.5" />
              Restart
            </Button>
            <Button
              size="sm"
              variant="ghost"
              class="text-destructive hover:bg-destructive/10 hover:text-destructive"
              :disabled="!!busyAction[app.id] || isBusy(app)"
              @click="uninstall(app)"
            >
              <Icon
                :name="busyAction[app.id] === 'uninstall' ? 'lucide:loader-2' : 'lucide:trash-2'"
                :class="['mr-1 h-3.5 w-3.5', busyAction[app.id] === 'uninstall' && 'animate-spin']"
              />
              Uninstall
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
