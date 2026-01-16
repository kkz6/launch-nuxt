<script setup lang="ts">
import { toast } from 'vue-sonner'
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
  <div v-if="visibleFeatures.length > 0">
    <h3 class="mb-4 text-lg font-semibold">Laravel Features</h3>
    <div class="grid gap-4 sm:grid-cols-2">
      <div
        v-for="feature in visibleFeatures"
        :key="feature.id"
        class="flex items-center justify-between gap-3 rounded-lg border bg-card p-4"
        :class="{ 'opacity-60': feature.pending }"
      >
        <div class="flex flex-1 items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon :name="feature.icon" class="h-5 w-5 text-primary" />
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
          :model-value="feature.enabled"
          :disabled="feature.pending"
          @update:model-value="toggleFeature(feature.id, feature.enabled)"
        />
      </div>
    </div>
  </div>
</template>
