<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { useDeploymentEvents } from '~/composables/useChannelEvents'
import type { Site, Deployment } from '~/types'

interface Props {
  serverId: string
  siteId: string
  site: Site
}

const props = defineProps<Props>()

// Get current team for WebSocket channel
const { user } = useAuth()
const teamId = computed(() => user.value?.current_team_id?.toString() || '')

// Subscribe to real-time deployment events
useDeploymentEvents(teamId, (data) => {
  // Only refresh if the event is for this site
  if (data.site_id === props.siteId) {
    fetchDeployments()
  }
})

const deployments = ref<Deployment[]>([])
const isLoading = ref(true)
const rollingBackId = ref<string | null>(null)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  installing: 'bg-yellow-500 animate-pulse',
  running: 'bg-blue-500 animate-pulse',
  finished: 'bg-green-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
}

const hasActiveDeployment = computed(() => {
  return deployments.value.some(d => d.status === 'pending' || d.status === 'installing')
})

const firstFinishedIndex = computed(() => {
  return deployments.value.findIndex(d => d.status === 'finished')
})

const canRollback = (deployment: Deployment, index: number) => {
  if (!props.site.zero_downtime_deployment) return false
  if (deployment.status !== 'finished') return false
  // Can't rollback to the most recent finished deployment
  if (index === firstFinishedIndex.value) return false
  return true
}

const fetchDeployments = async () => {
  try {
    const data = await $api<{ data: Deployment[] }>(`/servers/${props.serverId}/sites/${props.siteId}/deployments`)
    deployments.value = data.data
  } catch {
    toast.error('Failed to load deployments')
  } finally {
    isLoading.value = false
  }
}

const handleRollback = async (deployment: Deployment) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Rollback to this deployment?',
    description: 'This will switch the current release to the selected deployment. The site will immediately serve the code from this previous release.',
    confirmText: 'Confirm Rollback',
    cancelText: 'Cancel',
  })

  if (!result.ok) return

  rollingBackId.value = deployment.id
  try {
    await $api(`/servers/${props.serverId}/sites/${props.siteId}/deployments/${deployment.id}/rollback`, {
      method: 'POST',
    })
    toast.success('Rollback initiated')
    await fetchDeployments()
  } catch {
    toast.error('Failed to initiate rollback')
  } finally {
    rollingBackId.value = null
  }
}

const getCommitHeading = (message: string | undefined): string => {
  if (!message) return ''
  return message.split('\n')[0]
}

const deployWebhookUrl = computed(() => {
  const config = useRuntimeConfig()
  return `${config.public.apiBase}/sites/${props.siteId}/deploy/${props.site.deploy_token}`
})

const copyToClipboard = (text: string) => {
  if (typeof window !== 'undefined') {
    window.navigator.clipboard.writeText(text)
    toast.success('Copied!')
  }
}

onMounted(fetchDeployments)
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">Deployments</h3>
        <p class="text-sm text-muted-foreground">View deployment history for this site</p>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <div class="mb-4 rounded-lg border bg-card p-4">
        <p class="mb-2 text-sm text-muted-foreground">
          Use this webhook URL in your git provider to enable automatic deployments:
        </p>
        <div class="flex flex-row flex-wrap items-center gap-2">
          <code class="flex-1 break-all rounded bg-muted px-2 py-1 text-sm text-muted-foreground">
            {{ deployWebhookUrl }}
          </code>
          <Button variant="ghost" size="sm" @click="copyToClipboard(deployWebhookUrl)">
            <Icon name="lucide:copy" class="block size-4" />
          </Button>
        </div>
      </div>

      <div v-if="deployments.length === 0" class="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card py-12">
        <Icon name="lucide:rocket" class="h-8 w-8 text-muted-foreground" />
        <span class="text-base text-muted-foreground">No deployments yet</span>
      </div>

      <div v-else class="rounded-lg border bg-card">
        <div
          v-for="(deployment, index) in deployments"
          :key="deployment.id"
          class="flex items-center justify-between gap-2 border-b p-4 last:border-b-0"
        >
          <div class="flex flex-col">
            <span class="flex items-center gap-2 font-medium capitalize text-foreground">
              <Badge
                v-if="deployment.commit_data?.rollback_to"
                variant="outline"
                class="gap-1 border-amber-600 text-amber-600"
              >
                <Icon name="lucide:history" class="block size-3" />
                Rollback
              </Badge>
              {{ deployment.status }}
              <span :class="['size-2.5 rounded-full', statusColors[deployment.status] || 'bg-gray-500']" />
            </span>
            <div class="flex flex-wrap gap-2">
              <span class="text-sm text-muted-foreground">
                {{ deployment.user?.name || deployment.commit_data?.name || 'Unknown' }}
              </span>
              <span v-if="deployment.commit_data?.sha" class="font-mono text-sm text-muted-foreground">
                {{ deployment.commit_data.sha.substring(0, 6) }}
              </span>
            </div>

            <span v-if="deployment.commit_data?.rollback_to" class="text-sm text-muted-foreground">
              Rolled back to previous release
            </span>
            <span v-else-if="deployment.commit_data?.message" class="text-sm text-muted-foreground">
              {{ getCommitHeading(deployment.commit_data.message) }}
            </span>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="text-sm capitalize text-muted-foreground">
              <SharedDateTooltip :date="deployment.created_at" />
            </div>
            <div class="flex flex-row items-center gap-2">
              <Button
                v-if="canRollback(deployment, index)"
                variant="outline"
                size="sm"
                :disabled="hasActiveDeployment || rollingBackId === deployment.id"
                @click="handleRollback(deployment)"
              >
                <Icon
                  v-if="rollingBackId === deployment.id"
                  name="lucide:loader-2"
                  class="mr-1 block size-4 animate-spin"
                />
                <Icon v-else name="lucide:rotate-ccw" class="mr-1 block size-4" />
                Rollback
              </Button>
              <SiteDeploymentLogs
                v-if="deployment.task_id"
                :server-id="serverId"
                :task-id="deployment.task_id"
                :commit-message="getCommitHeading(deployment.commit_data?.message)"
                :commit-sha="deployment.commit_data?.sha?.substring(0, 6)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
