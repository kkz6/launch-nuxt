<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Switch } from '~/components/ui/switch'
import { Label } from '~/components/ui/label'
import type { Site } from '~/types'

interface Props {
  serverId: string
  site: Site
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updated: []
}>()

interface Feature {
  id: string
  name: string
  description: string
  icon: string
  enabled: boolean
  pending: boolean
  alwaysVisible: boolean
}

const isFeatureEnabled = (featureName: string): boolean => {
  const enabledFeatures = props.site.enabled_features || []
  return enabledFeatures.some((feature) => {
    if (typeof feature === 'string') {
      return feature === featureName
    }
    if (typeof feature === 'object' && feature !== null) {
      return (feature as { name?: string }).name === featureName
    }
    return false
  })
}

const features = computed<Feature[]>(() => {
  const pendingFeatures = props.site.pending_features || []

  return [
    {
      id: 'scheduler',
      name: 'Task Scheduler',
      description: 'Enable Laravel task scheduling via cron',
      icon: 'lucide:calendar',
      enabled: isFeatureEnabled('scheduler'),
      pending: pendingFeatures.includes('scheduler'),
      alwaysVisible: true,
    },
    {
      id: 'queue',
      name: 'Queue Workers',
      description: 'Manage Laravel queue workers',
      icon: 'lucide:database',
      enabled: isFeatureEnabled('queue'),
      pending: pendingFeatures.includes('queue'),
      alwaysVisible: true,
    },
  ]
})

const visibleFeatures = computed(() => features.value.filter((f) => f.alwaysVisible))

const toggleFeature = async (featureId: string, currentlyEnabled: boolean) => {
  const action = currentlyEnabled ? 'disable' : 'enable'

  try {
    await $api(`/servers/${props.serverId}/sites/${props.site.id}/features/${featureId}/${action}`, {
      method: 'POST',
    })
    toast.success(`Feature ${action}d successfully`)
    emit('updated')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || `Failed to ${action} feature`)
  }
}
</script>

<template>
  <Card v-if="visibleFeatures.length > 0" class="bg-background">
    <CardHeader>
      <CardTitle>Laravel Features</CardTitle>
      <CardDescription>
        Configure Laravel-specific features for your application
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div
        v-for="feature in visibleFeatures"
        :key="feature.id"
        class="flex items-center justify-between space-x-3"
        :class="{ 'opacity-60': feature.pending }"
      >
        <div class="flex flex-1 items-center space-x-3">
          <div class="rounded-md bg-muted p-1.5">
            <Icon :name="feature.icon" class="h-4 w-4 text-muted-foreground" />
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <Label
                :for="`${feature.id}-toggle`"
                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {{ feature.name }}
              </Label>
              <Icon
                v-if="feature.pending"
                name="lucide:loader-2"
                class="h-4 w-4 animate-spin text-primary"
              />
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ feature.description }}
              <span v-if="feature.pending"> (Processing...)</span>
            </p>
          </div>
        </div>
        <Switch
          :id="`${feature.id}-toggle`"
          :checked="feature.enabled"
          :disabled="feature.pending"
          class="scale-90"
          @update:checked="toggleFeature(feature.id, feature.enabled)"
        />
      </div>
    </CardContent>
  </Card>
</template>
