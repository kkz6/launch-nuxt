<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

interface Version {
  label: string
  version: string
  type: string
  installed: boolean
}

interface AvailableService {
  label: string
  type: string
  current: string
  image_path: string
  versions: Record<string, Version>
  hasStart: boolean
  hasStop: boolean
  hasRestart: boolean
  hasRemove: boolean
  hasStatus: boolean
  installed: boolean
}

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'installed': []
}>()

const open = defineModel<boolean>('open', { required: true })

const availableServices = ref<Record<string, AvailableService>>({})
const installedServices = ref<Record<string, AvailableService>>({})
const isLoading = ref(true)
const selectedService = ref<string | null>(null)
const selectedVersion = ref<string | null>(null)
const isInstalling = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchAvailableServices = async () => {
  isLoading.value = true
  try {
    const data = await $api<{
      data: {
        available_services: Record<string, AvailableService>
        installed_services: Record<string, AvailableService>
      }
    }>(`/servers/${props.serverId}/services/create`)
    availableServices.value = data.data.available_services || {}
    installedServices.value = data.data.installed_services || {}
  } catch {
    toast.error('Failed to load available services')
  } finally {
    isLoading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    fetchAvailableServices()
    selectedService.value = null
    selectedVersion.value = null
  }
})

const handleCloseDialog = () => {
  open.value = false
  selectedService.value = null
  selectedVersion.value = null
}

const handleServiceSelect = (serviceKey: string) => {
  selectedService.value = serviceKey
  selectedVersion.value = null

  const service = availableServices.value[serviceKey]
  if (service?.versions) {
    const versions = getAvailableVersionsForService(serviceKey)
    if (versions.length === 1) {
      selectedVersion.value = versions[0].type
    }
  }
}

const getAvailableVersionsForService = (serviceKey: string) => {
  const service = availableServices.value[serviceKey]
  if (!service?.versions) return []

  return Object.values(service.versions).filter(version => !version.installed)
}

const handleInstall = async () => {
  if (!selectedService.value || !selectedVersion.value) return

  const service = availableServices.value[selectedService.value]
  const version = Object.values(service?.versions || {}).find(v => v.type === selectedVersion.value)

  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Install Service',
    description: `Are you sure you want to install ${service?.label || selectedService.value} (${version?.version || selectedVersion.value})?`,
    confirmText: 'Install',
    cancelText: 'Cancel',
  })

  if (!result.ok) return

  isInstalling.value = true

  try {
    await $api(`/servers/${props.serverId}/services/${selectedVersion.value}`, {
      method: 'POST',
    })
    toast.success('Service installation initiated')
    emit('installed')
    handleCloseDialog()
  } catch {
    toast.error('Failed to install service')
  } finally {
    isInstalling.value = false
  }
}

const availableVersions = computed(() => {
  if (!selectedService.value) return []
  return getAvailableVersionsForService(selectedService.value)
})

const getServiceImagePath = (type: string) => {
  const imageMap: Record<string, string> = {
    php: '/images/services/php.svg',
    mysql: '/images/services/mysql.svg',
    postgresql: '/images/services/postgresql.svg',
    webserver: '/images/services/webserver.svg',
    process_manager: '/images/services/process_manager.svg',
    memory_database: '/images/services/memory_database.svg',
    package_manager: '/images/services/package_manager.svg',
    bun: '/images/services/bun.svg',
    node: '/images/services/node.svg',
    launch_agent: '/images/services/launch_agent.svg',
  }
  return imageMap[type] || '/images/services/package_manager.svg'
}
</script>

<template>
  <Dialog v-model:open="open">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <DialogContent class="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]">
      <DialogHeader class="border-b px-6 pb-4 pt-6">
        <DialogTitle>Install Service</DialogTitle>
        <DialogDescription>
          Select a service to install on your server
        </DialogDescription>
      </DialogHeader>

      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <!-- Service List -->
        <div class="flex-1 overflow-y-auto">
          <div class="divide-y">
            <button
              v-for="(service, key) in availableServices"
              :key="key"
              type="button"
              :disabled="getAvailableVersionsForService(String(key)).length === 0"
              :class="[
                'flex w-full items-center gap-4 px-6 py-4 text-left transition-colors',
                getAvailableVersionsForService(String(key)).length === 0
                  ? 'cursor-not-allowed bg-muted/30 opacity-50'
                  : selectedService === key
                    ? 'bg-primary/5'
                    : 'hover:bg-muted/50',
              ]"
              @click="getAvailableVersionsForService(String(key)).length > 0 && handleServiceSelect(String(key))"
            >
              <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                <img
                  :src="service.image_path || getServiceImagePath(service.type)"
                  :alt="service.label"
                  class="h-6 w-6 object-contain"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                >
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-medium">{{ service.label }}</div>
                <div class="text-sm text-muted-foreground">
                  {{
                    getAvailableVersionsForService(String(key)).length === 0
                      ? 'All versions installed'
                      : `${getAvailableVersionsForService(String(key)).length} version${getAvailableVersionsForService(String(key)).length !== 1 ? 's' : ''} available`
                  }}
                </div>
              </div>
              <Icon
                v-if="selectedService === key && getAvailableVersionsForService(String(key)).length > 0"
                name="lucide:check-circle-2"
                class="h-5 w-5 flex-shrink-0 text-primary"
              />
            </button>
          </div>

          <div v-if="Object.keys(availableServices).length === 0" class="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="lucide:package" class="mb-3 h-8 w-8 text-muted-foreground" />
            <p class="text-muted-foreground">No services available to install</p>
          </div>
        </div>

        <!-- Version Selection -->
        <Transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 max-h-0"
          enter-to-class="opacity-100 max-h-40"
          leave-active-class="transition-all duration-200"
          leave-from-class="opacity-100 max-h-40"
          leave-to-class="opacity-0 max-h-0"
        >
          <div v-if="selectedService && availableVersions.length > 0" class="overflow-hidden border-t bg-muted/30">
            <div class="px-6 py-4">
              <label class="mb-3 block text-sm font-medium">Select Version</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="version in availableVersions"
                  :key="version.type"
                  type="button"
                  :class="[
                    'rounded-md border px-4 py-2 text-sm font-medium transition-all',
                    selectedVersion === version.type
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted',
                  ]"
                  @click="selectedVersion = version.type"
                >
                  {{ version.label }}
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button type="button" variant="outline" :disabled="isInstalling" @click="handleCloseDialog">
            Cancel
          </Button>
          <Button type="button" :disabled="!selectedService || !selectedVersion || isInstalling" @click="handleInstall">
            <Icon v-if="isInstalling" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ isInstalling ? 'Installing...' : 'Install Service' }}
          </Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
