<script setup lang="ts">
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import type { Server, Site } from '~/types'

interface Props {
  server: Server
  site: Site
}

const props = defineProps<Props>()

const showLogs = ref(false)

const statusConfig: Record<string, { variant: 'success' | 'destructive' | 'secondary' | 'warning'; label: string; icon: string }> = {
  pending: { variant: 'warning', label: 'Deploying', icon: 'lucide:loader-2' },
  installing: { variant: 'warning', label: 'Installing', icon: 'lucide:loader-2' },
  running: { variant: 'warning', label: 'Running', icon: 'lucide:loader-2' },
  finished: { variant: 'success', label: 'Success', icon: 'lucide:check' },
  completed: { variant: 'success', label: 'Success', icon: 'lucide:check' },
  failed: { variant: 'destructive', label: 'Failed', icon: 'lucide:x' },
}

const getCommitHeading = (message: string): string => {
  if (!message) return ''
  return message.split('\n')[0]
}

const getCommitUrl = (sha: string): string | null => {
  if (!props.site.repository || !sha) return null
  return `${props.site.repository}/commit/${sha}`
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 class="text-lg font-semibold">Latest Deployment</h3>
        <Badge v-if="site.zero_downtime_deployment" variant="outline" class="font-normal">
          Zero Downtime
        </Badge>
      </div>
      <SiteAutodeploy :server-id="server.id" :site-id="site.id" :auto-deployment="site.auto_deployment" />
    </div>

    <div v-if="site.latest_deployment" class="rounded-lg border bg-card p-4">
      <!-- Header row with status and time -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Badge
            :variant="statusConfig[site.latest_deployment.status]?.variant || 'secondary'"
            class="gap-1"
          >
            <Icon
              v-if="statusConfig[site.latest_deployment.status]?.icon"
              :name="statusConfig[site.latest_deployment.status].icon"
              :class="['size-3', ['pending', 'installing', 'running'].includes(site.latest_deployment.status) && 'animate-spin']"
            />
            {{ statusConfig[site.latest_deployment.status]?.label || site.latest_deployment.status }}
          </Badge>
        </div>
        <div class="text-sm text-muted-foreground">
          <SharedDateTooltip :date="site.latest_deployment.created_at" />
        </div>
      </div>

      <!-- Commit info -->
      <div v-if="site.latest_deployment.commit_data" class="mt-3 space-y-2">
        <!-- Commit message -->
        <p v-if="site.latest_deployment.commit_data.message" class="text-sm font-medium">
          {{ getCommitHeading(site.latest_deployment.commit_data.message) }}
        </p>

        <!-- Meta info row -->
        <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <!-- Author -->
          <div v-if="site.latest_deployment.commit_data.name" class="flex items-center gap-1.5">
            <Icon name="lucide:user" class="size-3.5" />
            <span>{{ site.latest_deployment.commit_data.name }}</span>
          </div>

          <!-- Branch -->
          <div v-if="site.repository_branch" class="flex items-center gap-1.5">
            <Icon name="lucide:git-branch" class="size-3.5" />
            <span>{{ site.repository_branch }}</span>
          </div>

          <!-- Commit SHA -->
          <div v-if="site.latest_deployment.commit_data.sha" class="flex items-center gap-1.5">
            <Icon name="lucide:git-commit-horizontal" class="size-3.5" />
            <a
              v-if="getCommitUrl(site.latest_deployment.commit_data.sha)"
              :href="getCommitUrl(site.latest_deployment.commit_data.sha)!"
              target="_blank"
              rel="noopener noreferrer"
              class="font-mono hover:underline"
            >
              {{ site.latest_deployment.commit_data.sha.substring(0, 7) }}
            </a>
            <span v-else class="font-mono">
              {{ site.latest_deployment.commit_data.sha.substring(0, 7) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Deployment logs for pending -->
      <div v-if="site.latest_deployment?.task_id && site.latest_deployment.status === 'pending'" class="mt-4 border-t pt-4">
        <div class="mb-2 flex items-center justify-between">
          <h4 class="text-sm font-medium">Deployment Logs</h4>
          <Button variant="ghost" size="sm" @click="showLogs = !showLogs">
            <Icon :name="showLogs ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="mr-1.5 size-4" />
            {{ showLogs ? 'Hide' : 'View' }}
          </Button>
        </div>

        <ServerLogViewer
          v-if="showLogs"
          :server-id="server.id"
          entity="task"
          :entity-id="site.latest_deployment.task_id"
          :no-timestamp="true"
          hide-options
          container-class-name="h-[200px]"
        />
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card py-8 text-muted-foreground">
      <Icon name="lucide:rocket" class="size-8" />
      <span class="text-sm">No deployments yet</span>
    </div>
  </div>
</template>
