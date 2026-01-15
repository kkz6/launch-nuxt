<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import type { Server, Site } from '~/types'

interface Props {
  server: Server
  site: Site
}

const props = defineProps<Props>()

const showLogs = ref(false)

const statusConfig: Record<string, { variant: 'success' | 'destructive' | 'secondary' | 'warning'; label: string }> = {
  pending: { variant: 'warning', label: 'Deploying' },
  running: { variant: 'warning', label: 'Running' },
  completed: { variant: 'success', label: 'Success' },
  failed: { variant: 'destructive', label: 'Failed' },
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
  <Card class="bg-background">
    <CardHeader class="flex flex-row items-center justify-between p-6 py-3">
      <CardTitle class="flex items-center gap-2 text-xl">
        <span>Deployments</span>
        <Badge v-if="site.zero_downtime_deployment" variant="outline" class="font-normal">
          Zero Downtime
        </Badge>
      </CardTitle>
      <SiteAutodeploy :server-id="server.id" :site-id="site.id" :auto-deployment="site.auto_deployment" />
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div v-if="site.latest_deployment" class="rounded-lg border p-4">
        <!-- Header row with status and time -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Badge
              :variant="statusConfig[site.latest_deployment.status]?.variant || 'secondary'"
              class="gap-1"
            >
              <Icon
                v-if="site.latest_deployment.status === 'pending'"
                name="lucide:loader-2"
                class="size-3 animate-spin"
              />
              <Icon
                v-else-if="site.latest_deployment.status === 'completed'"
                name="lucide:check"
                class="size-3"
              />
              <Icon
                v-else-if="site.latest_deployment.status === 'failed'"
                name="lucide:x"
                class="size-3"
              />
              {{ statusConfig[site.latest_deployment.status]?.label || 'Unknown' }}
            </Badge>
            <span class="text-sm text-muted-foreground">Latest deployment</span>
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
            <div v-if="site.branch" class="flex items-center gap-1.5">
              <Icon name="lucide:git-branch" class="size-3.5" />
              <span>{{ site.branch }}</span>
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
            <h3 class="text-sm font-medium">Deployment Logs</h3>
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

      <div v-else class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-8 text-muted-foreground">
        <Icon name="lucide:rocket" class="size-8" />
        <span class="text-sm">No deployments yet</span>
      </div>
    </CardContent>
  </Card>
</template>
