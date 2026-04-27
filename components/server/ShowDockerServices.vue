<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { useDockerServiceEvents } from '~/composables/useChannelEvents'
import { serverService } from '~/services/serverService'
import type { DockerService, DockerServiceKind, Server } from '~/types'

interface Props {
  server: Server
}

const props = defineProps<Props>()
const serverId = computed(() => props.server.id)

const services = ref<DockerService[]>([])
const isLoading = ref(true)
const busyAction = ref<Record<string, string | null>>({})

const installDialogOpen = ref(false)
const logsDialog = reactive<{
  open: boolean
  kind: DockerServiceKind | null
  kindLabel: string
}>({ open: false, kind: null, kindLabel: '' })

const confirmationDialog = ref<
  InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null
>(null)

const installedKinds = computed<DockerServiceKind[]>(() =>
  services.value.map((s) => s.kind),
)

const allSlots: { kind: DockerServiceKind; label: string; icon: string }[] = [
  { kind: 'postgres', label: 'PostgreSQL', icon: 'lucide:database' },
  { kind: 'mysql', label: 'MySQL', icon: 'lucide:database' },
  { kind: 'redis', label: 'Redis', icon: 'lucide:server' },
]

const findService = (kind: DockerServiceKind) =>
  services.value.find((s) => s.kind === kind)

const statusVariant = (status: DockerService['status']) => {
  switch (status) {
    case 'running':
      return 'success'
    case 'stopped':
      return 'secondary'
    case 'failed':
      return 'destructive'
    case 'installing':
    case 'pending':
    default:
      return 'outline'
  }
}

const isBusy = (svc: DockerService) =>
  svc.status === 'installing' || svc.status === 'pending'

const fetchData = async () => {
  try {
    const res = await serverService.dockerServices.list(serverId.value)
    services.value = res.data ?? []
  } catch {
    toast.error('Failed to load docker services')
  } finally {
    isLoading.value = false
  }
}

const setAction = (kind: DockerServiceKind, action: string | null) => {
  busyAction.value = { ...busyAction.value, [kind]: action }
}

const start = async (svc: DockerService) => {
  setAction(svc.kind, 'start')
  try {
    await serverService.dockerServices.start(serverId.value, svc.kind)
    toast.success(`${svc.kind_label} started`)
    fetchData()
  } catch {
    toast.error(`Failed to start ${svc.kind_label}`)
  } finally {
    setAction(svc.kind, null)
  }
}

const stop = async (svc: DockerService) => {
  setAction(svc.kind, 'stop')
  try {
    await serverService.dockerServices.stop(serverId.value, svc.kind)
    toast.success(`${svc.kind_label} stopped`)
    fetchData()
  } catch {
    toast.error(`Failed to stop ${svc.kind_label}`)
  } finally {
    setAction(svc.kind, null)
  }
}

const restart = async (svc: DockerService) => {
  setAction(svc.kind, 'restart')
  try {
    await serverService.dockerServices.restart(serverId.value, svc.kind)
    toast.success(`${svc.kind_label} restarted`)
    fetchData()
  } catch {
    toast.error(`Failed to restart ${svc.kind_label}`)
  } finally {
    setAction(svc.kind, null)
  }
}

const uninstall = async (svc: DockerService) => {
  if (!confirmationDialog.value) return
  const result = await confirmationDialog.value.show({
    title: `Uninstall ${svc.kind_label}?`,
    description:
      'The container will be removed. The named volume is kept by default — check the box below to drop it permanently.',
    confirmText: 'Uninstall',
    cancelText: 'Cancel',
    destructive: true,
    helpText: 'Type the kind to confirm:',
    inputVerificationText: svc.kind,
    checkbox: {
      label: 'Also delete the data volume (irreversible)',
      checked: false,
    },
  })

  if (!result.ok) return

  const removeData = result.checkbox?.checked === true
  setAction(svc.kind, 'uninstall')
  try {
    await serverService.dockerServices.uninstall(
      serverId.value,
      svc.kind,
      removeData,
    )
    toast.success(`${svc.kind_label} uninstall started`)
    fetchData()
  } catch {
    toast.error(`Failed to uninstall ${svc.kind_label}`)
    setAction(svc.kind, null)
  }
}

const viewLogs = (svc: DockerService) => {
  logsDialog.kind = svc.kind
  logsDialog.kindLabel = svc.kind_label
  logsDialog.open = true
}

// WebSocket — refetch when a docker_service event arrives for this server.
const { user } = useAuth()
const teamId = computed(() => user.value?.current_team_id?.toString() || '')
let refetchTimer: ReturnType<typeof setTimeout> | null = null

useDockerServiceEvents(teamId, (data) => {
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

    <ServerCreateDockerService
      v-model:open="installDialogOpen"
      :server-id="serverId"
      :installed-kinds="installedKinds"
      @created="fetchData"
    />

    <ServerDockerServiceLogsDialog
      v-if="logsDialog.kind"
      v-model:open="logsDialog.open"
      :server-id="serverId"
      :kind="logsDialog.kind"
      :kind-label="logsDialog.kindLabel"
    />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">Docker services</h3>
        <p class="text-sm text-muted-foreground">
          Run a managed Postgres, MySQL, or Redis container on this Docker server.
          One instance per kind, sharing the launch-network.
        </p>
      </div>
      <Button
        v-if="services.length < allSlots.length"
        size="sm"
        @click="installDialogOpen = true"
      >
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Install service
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="slot in allSlots" :key="slot.kind">
        <CardHeader class="flex flex-row items-start justify-between space-y-0 pb-2">
          <div class="flex items-center gap-2">
            <Icon :name="slot.icon" class="h-5 w-5 text-muted-foreground" />
            <CardTitle class="text-base">{{ slot.label }}</CardTitle>
          </div>
          <Badge
            v-if="findService(slot.kind)"
            :variant="statusVariant(findService(slot.kind)!.status)"
          >
            {{ findService(slot.kind)!.status_label }}
          </Badge>
          <Badge v-else variant="outline">Not installed</Badge>
        </CardHeader>

        <CardContent class="space-y-3">
          <template v-if="findService(slot.kind)">
            <div class="space-y-1 text-xs text-muted-foreground">
              <div class="flex justify-between gap-2">
                <span>Image</span>
                <span class="font-mono text-foreground">
                  {{ findService(slot.kind)!.image }}
                </span>
              </div>
              <div class="flex justify-between gap-2">
                <span>Container</span>
                <span class="font-mono text-foreground">
                  {{ findService(slot.kind)!.container }}
                </span>
              </div>
              <div
                v-if="findService(slot.kind)!.database_name"
                class="flex justify-between gap-2"
              >
                <span>Database</span>
                <span class="font-mono text-foreground">
                  {{ findService(slot.kind)!.database_name }}
                </span>
              </div>
              <div
                v-if="findService(slot.kind)!.username"
                class="flex justify-between gap-2"
              >
                <span>User</span>
                <span class="font-mono text-foreground">
                  {{ findService(slot.kind)!.username }}
                </span>
              </div>
            </div>

            <p
              v-if="findService(slot.kind)!.last_error"
              class="rounded bg-destructive/10 p-2 text-xs text-destructive"
            >
              {{ findService(slot.kind)!.last_error }}
            </p>

            <div class="flex flex-wrap gap-2">
              <Button
                v-if="findService(slot.kind)!.status === 'stopped'"
                size="sm"
                variant="outline"
                :disabled="!!busyAction[slot.kind] || isBusy(findService(slot.kind)!)"
                @click="start(findService(slot.kind)!)"
              >
                <Icon
                  :name="busyAction[slot.kind] === 'start' ? 'lucide:loader-2' : 'lucide:play'"
                  :class="['mr-1 h-3.5 w-3.5', busyAction[slot.kind] === 'start' && 'animate-spin']"
                />
                Start
              </Button>
              <Button
                v-if="findService(slot.kind)!.status === 'running'"
                size="sm"
                variant="outline"
                :disabled="!!busyAction[slot.kind] || isBusy(findService(slot.kind)!)"
                @click="stop(findService(slot.kind)!)"
              >
                <Icon
                  :name="busyAction[slot.kind] === 'stop' ? 'lucide:loader-2' : 'lucide:pause'"
                  :class="['mr-1 h-3.5 w-3.5', busyAction[slot.kind] === 'stop' && 'animate-spin']"
                />
                Stop
              </Button>
              <Button
                v-if="findService(slot.kind)!.status === 'running' || findService(slot.kind)!.status === 'stopped'"
                size="sm"
                variant="outline"
                :disabled="!!busyAction[slot.kind] || isBusy(findService(slot.kind)!)"
                @click="restart(findService(slot.kind)!)"
              >
                <Icon
                  :name="busyAction[slot.kind] === 'restart' ? 'lucide:loader-2' : 'lucide:rotate-ccw'"
                  :class="['mr-1 h-3.5 w-3.5', busyAction[slot.kind] === 'restart' && 'animate-spin']"
                />
                Restart
              </Button>
              <Button
                size="sm"
                variant="outline"
                :disabled="isBusy(findService(slot.kind)!)"
                @click="viewLogs(findService(slot.kind)!)"
              >
                <Icon name="lucide:scroll-text" class="mr-1 h-3.5 w-3.5" />
                Logs
              </Button>
              <Button
                size="sm"
                variant="ghost"
                class="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                :disabled="!!busyAction[slot.kind] || isBusy(findService(slot.kind)!)"
                @click="uninstall(findService(slot.kind)!)"
              >
                <Icon
                  :name="busyAction[slot.kind] === 'uninstall' ? 'lucide:loader-2' : 'lucide:trash-2'"
                  :class="['mr-1 h-3.5 w-3.5', busyAction[slot.kind] === 'uninstall' && 'animate-spin']"
                />
                Uninstall
              </Button>
            </div>
          </template>

          <template v-else>
            <p class="text-sm text-muted-foreground">
              Not installed on this server yet.
            </p>
            <Button
              variant="outline"
              size="sm"
              @click="installDialogOpen = true"
            >
              <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
              Install {{ slot.label }}
            </Button>
          </template>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
