<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

interface PhpExtension {
  value: string
  label: string
  status: string
  is_installed: boolean
  is_pending: boolean
}

interface PhpOpcache {
  enable_cli: boolean
  enabled: boolean
  interned_strings_buffer: number
  jit_buffer_size: string
  jit_enabled: boolean
  jit_mode: string
  max_accelerated_files: number
  memory_consumption: number
  revalidate_freq: number
  save_comments: boolean
  status: string
  validate_timestamps: boolean
}

interface PhpDetails {
  id: string
  server_id: string
  type: string
  type_label: string
  name: string
  version: string
  status: string
  status_label: string
  is_default: boolean
  software: string
  software_label: string
  extensions?: PhpExtension[]
  opcache?: PhpOpcache
  created_at: string
  updated_at: string
}

interface PhpVersionData {
  key: string
  display_name: string
  version: string
  is_installed: boolean
  is_default: boolean
  details?: PhpDetails
}

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const phpVersions = ref<PhpVersionData[]>([])
const isLoading = ref(true)
const loadingStates = ref<Record<string, boolean>>({})
const selectedVersion = ref<string>('')
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Dialog states
const extensionsDialogOpen = ref(false)
const extensionsDialogService = ref<PhpVersionData | null>(null)

const opcacheDialogOpen = ref(false)
const opcacheDialogService = ref<PhpVersionData | null>(null)

const fetchPhpVersions = async () => {
  try {
    const response = await $api<PhpVersionData[] | { data: PhpVersionData[] }>(`/servers/${props.serverId}/php`)
    // Handle both array and { data: array } response formats
    phpVersions.value = Array.isArray(response) ? response : (response.data || [])
  } catch {
    toast.error('Failed to load PHP versions')
  } finally {
    isLoading.value = false
  }
}

const installedVersions = computed(() => phpVersions.value.filter(v => v.is_installed))
const availableVersions = computed(() => phpVersions.value.filter(v => !v.is_installed))

const isAnyInstalling = computed(() => {
  return phpVersions.value.some(
    v => v.details?.status === 'installing' || v.details?.status === 'pending'
  )
})

const isServiceInstalling = (service: PhpVersionData) => {
  const status = service.details?.status
  return status === 'installing' || status === 'pending'
}

const handleAction = async (action: () => Promise<void>, version: string) => {
  loadingStates.value = { ...loadingStates.value, [version]: true }
  try {
    await action()
  } finally {
    loadingStates.value = { ...loadingStates.value, [version]: false }
  }
}

const installPhp = async (version: string) => {
  if (!version || !confirmationDialog.value) return

  const versionData = phpVersions.value.find(v => v.key === version)
  const { ok } = await confirmationDialog.value.show({
    title: `Install PHP ${versionData?.display_name || version}`,
    description: 'Are you sure you want to install this PHP version?',
    confirmText: 'Install',
    cancelText: 'Cancel',
  })

  if (ok) {
    await handleAction(async () => {
      await $api(`/servers/${props.serverId}/php`, {
        method: 'POST',
        body: { version },
      })
      toast.success('PHP installation initiated')
      selectedVersion.value = ''
      fetchPhpVersions()
    }, version)
  }
}

const setDefault = async (php: PhpVersionData) => {
  if (!confirmationDialog.value) return

  const { ok } = await confirmationDialog.value.show({
    title: `Set ${php.display_name} as default`,
    description: 'This will make this version the default CLI PHP version.',
    confirmText: 'Set Default',
    cancelText: 'Cancel',
  })

  if (ok) {
    await handleAction(async () => {
      await $api(`/servers/${props.serverId}/php/${php.key}/default`, {
        method: 'POST',
      })
      toast.success('Default PHP version updated')
      fetchPhpVersions()
    }, php.key)
  }
}

const patchVersion = async (php: PhpVersionData) => {
  if (!confirmationDialog.value) return

  const { ok } = await confirmationDialog.value.show({
    title: `Patch ${php.display_name}`,
    description: 'This will update PHP to the latest patch version.',
    confirmText: 'Patch',
    cancelText: 'Cancel',
  })

  if (ok) {
    await handleAction(async () => {
      await $api(`/servers/${props.serverId}/php/${php.key}/patch`, {
        method: 'POST',
      })
      toast.success('PHP patch initiated')
      fetchPhpVersions()
    }, php.key)
  }
}

const uninstall = async (php: PhpVersionData) => {
  if (!confirmationDialog.value) return

  const { ok } = await confirmationDialog.value.show({
    title: `Uninstall ${php.display_name}`,
    description: 'Are you sure? This will remove this PHP version and all its configurations.',
    confirmText: 'Uninstall',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (ok) {
    await handleAction(async () => {
      await $api(`/servers/${props.serverId}/php/${php.details?.id || php.key}`, {
        method: 'DELETE',
      })
      toast.success('PHP version uninstalled')
      fetchPhpVersions()
    }, php.key)
  }
}

const openExtensionsDialog = (php: PhpVersionData) => {
  extensionsDialogService.value = php
  extensionsDialogOpen.value = true
}

const openOpcacheDialog = (php: PhpVersionData) => {
  opcacheDialogService.value = php
  opcacheDialogOpen.value = true
}

onMounted(fetchPhpVersions)
</script>

<template>
  <div class="w-full">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Extensions Dialog -->
    <ServerSettingsPhpExtensionsDialog
      v-if="extensionsDialogService"
      v-model:open="extensionsDialogOpen"
      :server-id="serverId"
      :service="extensionsDialogService"
      @updated="fetchPhpVersions"
    />

    <!-- OPcache Dialog -->
    <ServerSettingsPhpOpcacheDialog
      v-if="opcacheDialogService"
      v-model:open="opcacheDialogOpen"
      :server-id="serverId"
      :service="opcacheDialogService"
      @updated="fetchPhpVersions"
    />

    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Empty State -->
      <div v-if="installedVersions.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
        <div class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Icon name="lucide:package" class="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 class="mb-2 text-xl font-semibold">No PHP versions installed</h2>
        <p class="mb-8 max-w-md text-muted-foreground">
          Install your first PHP version to start running PHP applications on your server.
        </p>
        <div class="flex items-center gap-2">
          <Select v-model="selectedVersion">
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="Select PHP Version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="version in availableVersions"
                :key="version.key"
                :value="version.key"
              >
                {{ version.display_name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            :disabled="!selectedVersion || loadingStates[selectedVersion]"
            @click="installPhp(selectedVersion)"
          >
            <Icon
              v-if="loadingStates[selectedVersion]"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            <Icon v-else name="lucide:plus" class="mr-2 h-4 w-4" />
            Install PHP
          </Button>
        </div>
      </div>

      <!-- PHP Versions Table -->
      <div v-else class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">PHP Versions</h1>
            <p class="mt-1 text-sm text-muted-foreground sm:text-base">
              {{ installedVersions.length }} PHP version{{ installedVersions.length !== 1 ? 's' : '' }} installed
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Select v-model="selectedVersion" :disabled="isAnyInstalling || availableVersions.length === 0">
              <SelectTrigger class="w-[140px] sm:w-[160px]">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="version in availableVersions"
                  :key="version.key"
                  :value="version.key"
                  :disabled="loadingStates[version.key] || isAnyInstalling"
                >
                  {{ version.display_name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              :disabled="!selectedVersion || loadingStates[selectedVersion] || isAnyInstalling"
              @click="installPhp(selectedVersion)"
            >
              <Icon
                v-if="loadingStates[selectedVersion]"
                name="lucide:loader-2"
                class="mr-2 h-4 w-4 animate-spin"
              />
              <Icon v-else name="lucide:plus" class="mr-2 h-4 w-4" />
              Install
            </Button>
          </div>
        </div>

        <!-- Table -->
        <div class="overflow-hidden rounded-lg border">
          <!-- Table Header - Hidden on mobile -->
          <div class="hidden border-b bg-muted/50 px-6 py-3 md:grid md:grid-cols-12 md:gap-4">
            <div class="col-span-9 text-sm font-medium text-muted-foreground">Version</div>
            <div class="col-span-3 text-right text-sm font-medium text-muted-foreground">Actions</div>
          </div>

          <!-- Table Body -->
          <div class="divide-y">
            <div
              v-for="service in installedVersions"
              :key="service.key"
              :class="[
                'px-4 py-4 transition-colors md:px-6',
                isServiceInstalling(service) ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'hover:bg-muted/30',
              ]"
            >
              <!-- Mobile Layout -->
              <div class="flex flex-col gap-4 md:hidden">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <!-- PHP Badge -->
                    <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#777BB3]/10">
                      <span class="text-sm font-bold text-[#777BB3]">PHP</span>
                    </div>
                    <!-- Version Info -->
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium">{{ service.display_name }}</span>
                        <Icon
                          v-if="service.is_default"
                          name="lucide:star"
                          class="h-4 w-4 fill-yellow-500 text-yellow-500"
                        />
                        <Badge
                          v-if="isServiceInstalling(service)"
                          variant="secondary"
                          class="gap-1.5"
                        >
                          <Icon name="lucide:loader-2" class="h-3 w-3 animate-spin" />
                          Installing
                        </Badge>
                      </div>
                      <span v-if="service.is_default" class="text-xs text-muted-foreground">
                        Default CLI
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Icon
                      v-if="loadingStates[service.key]"
                      name="lucide:loader-2"
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button
                          variant="ghost"
                          size="sm"
                          :disabled="loadingStates[service.key] || isServiceInstalling(service) || isAnyInstalling"
                        >
                          <Icon name="lucide:more-horizontal" class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" class="w-48">
                        <template v-if="service.details?.status === 'installed'">
                          <DropdownMenuItem
                            v-if="service.details?.opcache"
                            @click="openOpcacheDialog(service)"
                          >
                            <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
                            OPcache
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            v-if="service.details?.extensions"
                            @click="openExtensionsDialog(service)"
                          >
                            <Icon name="lucide:package" class="mr-2 h-4 w-4" />
                            Extensions
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </template>
                        <DropdownMenuItem
                          v-if="!service.is_default && service.details?.status === 'installed'"
                          @click="setDefault(service)"
                        >
                          <Icon name="lucide:star" class="mr-2 h-4 w-4" />
                          Set as Default
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="!isServiceInstalling(service)"
                          @click="patchVersion(service)"
                        >
                          <Icon name="lucide:wrench" class="mr-2 h-4 w-4" />
                          Patch Version
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          class="text-destructive focus:text-destructive"
                          @click="uninstall(service)"
                        >
                          <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                          Uninstall
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              <!-- Desktop Layout -->
              <div class="hidden items-center gap-4 md:grid md:grid-cols-12">
                <div class="col-span-9 flex items-center gap-3">
                  <!-- PHP Badge -->
                  <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#777BB3]/10">
                    <span class="text-sm font-bold text-[#777BB3]">PHP</span>
                  </div>
                  <!-- Version Info -->
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-medium">{{ service.display_name }}</span>
                      <Icon
                        v-if="service.is_default"
                        name="lucide:star"
                        class="h-4 w-4 fill-yellow-500 text-yellow-500"
                      />
                      <Badge
                        v-if="isServiceInstalling(service)"
                        variant="secondary"
                        class="gap-1.5"
                      >
                        <Icon name="lucide:loader-2" class="h-3 w-3 animate-spin" />
                        Installing
                      </Badge>
                    </div>
                    <span v-if="service.is_default" class="text-xs text-muted-foreground">
                      Default CLI
                    </span>
                  </div>
                </div>
                <div class="col-span-3 flex items-center justify-end gap-2">
                  <Icon
                    v-if="loadingStates[service.key]"
                    name="lucide:loader-2"
                    class="h-4 w-4 animate-spin text-muted-foreground"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button
                        variant="ghost"
                        size="sm"
                        :disabled="loadingStates[service.key] || isServiceInstalling(service) || isAnyInstalling"
                      >
                        <Icon name="lucide:more-horizontal" class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-48">
                      <template v-if="service.details?.status === 'installed'">
                        <DropdownMenuItem
                          v-if="service.details?.opcache"
                          @click="openOpcacheDialog(service)"
                        >
                          <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
                          OPcache
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="service.details?.extensions"
                          @click="openExtensionsDialog(service)"
                        >
                          <Icon name="lucide:package" class="mr-2 h-4 w-4" />
                          Extensions
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </template>
                      <DropdownMenuItem
                        v-if="!service.is_default && service.details?.status === 'installed'"
                        @click="setDefault(service)"
                      >
                        <Icon name="lucide:star" class="mr-2 h-4 w-4" />
                        Set as Default
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-if="!isServiceInstalling(service)"
                        @click="patchVersion(service)"
                      >
                        <Icon name="lucide:wrench" class="mr-2 h-4 w-4" />
                        Patch Version
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        class="text-destructive focus:text-destructive"
                        @click="uninstall(service)"
                      >
                        <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                        Uninstall
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
