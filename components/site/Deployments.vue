<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import type { Site, Deployment } from '~/types'

interface Props {
  serverId: string
  siteId: string
  site: Site
}

const props = defineProps<Props>()

const deployments = ref<Deployment[]>([])
const isLoading = ref(true)

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
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
  <Card class="bg-background">
    <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-2">
      <div class="flex flex-col gap-2">
        <CardTitle class="text-xl">Deployments</CardTitle>
        <CardDescription>View deployment history for this site</CardDescription>
      </div>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div class="flex flex-col gap-2 text-sm">
          <span>
            Use this webhook URL in your git provider to enable automatic deployments:
          </span>
          <div class="flex flex-row flex-wrap items-center gap-2">
            <span>Webhook URL:</span>
            <code class="break-all rounded bg-muted px-2 py-1 text-muted-foreground">
              {{ deployWebhookUrl }}
            </code>
            <Button variant="ghost" size="sm" @click="copyToClipboard(deployWebhookUrl)">
              <Icon name="lucide:copy" class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div v-if="deployments.length === 0" class="flex w-full flex-col items-center justify-center gap-3 pt-10">
          <Icon name="lucide:rocket" class="h-8 w-8 text-muted-foreground" />
          <span class="text-base text-muted-foreground">No deployments yet</span>
        </div>

        <div v-else class="flex flex-col gap-4">
          <div
            v-for="deployment in deployments"
            :key="deployment.id"
            class="flex items-center justify-between gap-2 rounded-md border p-4"
          >
            <div class="flex flex-col">
              <span class="flex items-center gap-4 font-medium capitalize text-foreground">
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

              <span v-if="deployment.commit_data?.message" class="text-sm text-muted-foreground">
                {{ getCommitHeading(deployment.commit_data.message) }}
              </span>
            </div>
            <div class="flex flex-col items-end gap-2">
              <div class="text-sm capitalize text-muted-foreground">
                <SharedDateTooltip :date="deployment.created_at" />
              </div>
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
      </template>
    </CardContent>
  </Card>
</template>
