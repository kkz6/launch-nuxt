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

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
}

const getCommitHeading = (message: string): string => {
  if (!message) return ''
  return message.split('\n')[0]
}
</script>

<template>
  <Card class="bg-background">
    <CardHeader class="flex flex-row items-center justify-between p-6 py-3">
      <CardTitle class="flex items-center space-x-2 text-xl">
        <span>Deployments</span>
        <Badge v-if="site.zero_downtime_deployment" variant="secondary" class="font-mono text-muted-foreground">
          Zero Downtime
        </Badge>
      </CardTitle>
      <SiteAutodeploy :server-id="server.id" :site-id="site.id" />
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div v-if="site.latest_deployment" class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-medium capitalize">Latest</span>
            <span
              :class="['size-2.5 rounded-full', statusColors[site.latest_deployment.status] || 'bg-gray-500']"
            />
          </div>
          <div class="text-sm text-muted-foreground">
            <SharedDateTooltip :date="site.latest_deployment.created_at" />
          </div>
        </div>

        <div v-if="site.latest_deployment.commit_data" class="flex flex-col gap-1">
          <div class="flex flex-wrap gap-2">
            <span v-if="site.latest_deployment.commit_data.name" class="text-sm text-muted-foreground">
              {{ site.latest_deployment.commit_data.name }}
            </span>
            <span v-if="site.latest_deployment.commit_data.sha" class="font-mono text-sm text-muted-foreground">
              {{ site.latest_deployment.commit_data.sha.substring(0, 6) }}
            </span>
          </div>
          <span v-if="site.latest_deployment.commit_data.message" class="text-sm text-muted-foreground">
            {{ getCommitHeading(site.latest_deployment.commit_data.message) }}
          </span>
        </div>
      </div>

      <div v-if="site.latest_deployment?.task_id && site.latest_deployment.status === 'pending'" class="mt-2">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-medium">Deployment Logs</h3>
          <Button variant="ghost" size="sm" @click="showLogs = !showLogs">
            {{ showLogs ? 'Hide Logs' : 'View Logs' }}
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

      <div v-if="!site.latest_deployment" class="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
        <Icon name="lucide:rocket" class="h-8 w-8" />
        <span>No deployments yet</span>
      </div>
    </CardContent>
  </Card>
</template>
