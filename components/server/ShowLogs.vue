<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import type { LogInfo } from '~/types'

interface Props {
  serverId: string
  type?: 'server' | 'site'
  siteId?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'server',
})

const logs = ref<LogInfo[]>([])
const selectedLogIndex = ref<string>('')
const isLoading = ref(true)

const fetchLogs = async () => {
  try {
    const endpoint = props.type === 'site'
      ? `/servers/${props.serverId}/sites/${props.siteId}/logs`
      : `/servers/${props.serverId}/logs`
    const data = await $api<{ data: LogInfo[] }>(endpoint)
    logs.value = data.data
  } catch {
    toast.error('Failed to load logs')
  } finally {
    isLoading.value = false
  }
}

const selectedLog = computed(() => {
  if (!selectedLogIndex.value) return null
  return logs.value[parseInt(selectedLogIndex.value)]
})

onMounted(fetchLogs)
</script>

<template>
  <Card class="bg-background">
    <CardHeader>
      <CardTitle class="text-xl">Logs</CardTitle>
      <CardDescription>View server and service logs</CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div class="space-y-2">
          <Label>Select Service</Label>
          <Select v-model="selectedLogIndex">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Select a service to view logs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="(log, index) in logs"
                :key="index"
                :value="String(index)"
              >
                {{ log.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ServerLogViewer
          v-if="selectedLog"
          :server-id="serverId"
          :entity="type"
          :entity-id="type === 'site' ? (siteId || '') : serverId"
          :software="selectedLog.software"
        />
      </template>
    </CardContent>
  </Card>
</template>
