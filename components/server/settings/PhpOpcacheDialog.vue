<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface OpcacheSettings {
  enabled: boolean
  enable_cli: boolean
  memory_consumption: number
  interned_strings_buffer: number
  max_accelerated_files: number
  validate_timestamps: boolean
  revalidate_freq: number
  save_comments: boolean
  jit_enabled: boolean
  jit_buffer_size: string
  jit_mode: string
}

interface OpcacheStatus {
  enabled: boolean
  error?: string
  memory?: {
    used: number
    free: number
    wasted: number
    usage_percentage: number
  }
  statistics?: {
    cached_scripts: number
    cached_keys: number
    max_cached_keys: number
    hits: number
    misses: number
    hit_rate: number
  }
  jit?: {
    enabled: boolean
    buffer_size: number
    buffer_free: number
  }
}

interface PhpService {
  id: string
  status: string
  version: string
  opcache?: OpcacheSettings
}

interface PhpVersionData {
  key: string
  display_name: string
  is_installed: boolean
  is_default: boolean
  details?: PhpService
}

interface Props {
  serverId: string
  service: PhpVersionData
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'updated': []
}>()

const open = defineModel<boolean>('open', { required: true })

const activeTab = ref('status')
const status = ref<OpcacheStatus | null>(null)
const statusLoading = ref(false)
const resetLoading = ref(false)
const submitting = ref(false)
const hasLoadedStatus = ref(false)

const defaultSettings: OpcacheSettings = {
  enabled: true,
  enable_cli: false,
  memory_consumption: 128,
  interned_strings_buffer: 16,
  max_accelerated_files: 10000,
  validate_timestamps: true,
  revalidate_freq: 2,
  save_comments: true,
  jit_enabled: false,
  jit_buffer_size: '100M',
  jit_mode: 'tracing',
}

const form = ref<OpcacheSettings>({ ...defaultSettings })

// Format PHP version from "php84" to "8.4"
const formatPhpVersion = (version: string): string => {
  if (version.startsWith('php')) {
    const numericPart = version.replace('php', '')
    if (numericPart.length === 2) {
      return `${numericPart[0]}.${numericPart[1]}`
    }
    return numericPart
  }
  return version
}

const phpVersion = computed(() => formatPhpVersion(props.service.details?.version || props.service.key))
const supportsJit = computed(() => parseFloat(phpVersion.value) >= 8.0)

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

watch(open, (isOpen) => {
  if (isOpen) {
    const currentSettings = props.service.details?.opcache
    form.value = { ...defaultSettings, ...currentSettings }
    // Reset status when dialog opens - user needs to click refresh
    status.value = null
    hasLoadedStatus.value = false
  }
})

const fetchStatus = async () => {
  statusLoading.value = true
  try {
    const data = await $api<OpcacheStatus>(`/servers/${props.serverId}/php/${props.service.details?.id}/opcache/status`)
    status.value = data
    hasLoadedStatus.value = true
  } catch {
    status.value = { enabled: false, error: 'Failed to fetch status' }
    hasLoadedStatus.value = true
  } finally {
    statusLoading.value = false
  }
}

const handleReset = async () => {
  resetLoading.value = true
  try {
    await $api(`/servers/${props.serverId}/php/${props.service.details?.id}/opcache/reset`, {
      method: 'POST',
    })
    toast.success('OPcache reset initiated')
    await fetchStatus()
  } catch {
    toast.error('Failed to reset OPcache')
  } finally {
    resetLoading.value = false
  }
}

const handleSubmit = async () => {
  submitting.value = true
  try {
    await $api(`/servers/${props.serverId}/php/${props.service.details?.id}/opcache/configure`, {
      method: 'POST',
      body: form.value,
    })
    toast.success('OPcache configuration updated')
    activeTab.value = 'status'
    emit('updated')
  } catch {
    toast.error('Failed to update OPcache configuration')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="lucide:zap" class="h-5 w-5" />
          OPcache - PHP {{ phpVersion }}
        </DialogTitle>
        <DialogDescription>
          Configure OPcache settings to optimize PHP performance.
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="configure">Configure</TabsTrigger>
        </TabsList>

        <TabsContent value="status" class="space-y-4">
          <!-- Initial state - show refresh button -->
          <div v-if="!hasLoadedStatus && !statusLoading" class="flex flex-col items-center justify-center py-12 text-center">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Icon name="lucide:zap" class="h-6 w-6 text-muted-foreground" />
            </div>
            <p class="mb-4 text-muted-foreground">Click the button below to fetch OPcache status</p>
            <Button :disabled="statusLoading" @click="fetchStatus">
              <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
              Refresh Status
            </Button>
          </div>

          <!-- Loading state -->
          <div v-else-if="statusLoading" class="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="lucide:loader-2" class="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <p class="text-muted-foreground">Fetching OPcache status...</p>
          </div>

          <!-- Error state -->
          <div v-else-if="status?.error" class="space-y-4">
            <div class="flex items-center gap-2 rounded-lg bg-amber-50 p-4 text-amber-600 dark:bg-amber-950/20">
              <Icon name="lucide:alert-circle" class="h-5 w-5" />
              <span>{{ status.error }}</span>
            </div>
            <div class="flex justify-center">
              <Button variant="outline" :disabled="statusLoading" @click="fetchStatus">
                <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </div>
          </div>

          <!-- Success state - show status data -->
          <template v-else-if="status">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Badge :variant="status.enabled ? 'default' : 'secondary'">
                  {{ status.enabled ? 'Enabled' : 'Disabled' }}
                </Badge>
                <Badge v-if="status.jit?.enabled" variant="outline" class="text-xs">
                  JIT Active
                </Badge>
              </div>
              <div class="flex items-center gap-2">
                <Button variant="outline" size="sm" :disabled="statusLoading" @click="fetchStatus">
                  <Icon name="lucide:refresh-cw" :class="['h-4 w-4', statusLoading && 'animate-spin']" />
                </Button>
                <Button variant="secondary" size="sm" :disabled="resetLoading" @click="handleReset">
                  <Icon v-if="resetLoading" name="lucide:loader-2" class="mr-1 h-4 w-4 animate-spin" />
                  <Icon v-else name="lucide:refresh-cw" class="mr-1 h-4 w-4" />
                  Reset Cache
                </Button>
              </div>
            </div>

            <div v-if="status.enabled" class="grid grid-cols-2 gap-3">
              <!-- Memory Used -->
              <div class="flex items-center gap-3 rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]">
                <div class="rounded-md bg-primary/10 p-2">
                  <Icon name="lucide:hard-drive" class="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Memory Used</p>
                  <p class="font-medium">{{ formatBytes(status.memory?.used || 0) }}</p>
                  <p class="text-xs text-muted-foreground">{{ formatBytes(status.memory?.free || 0) }} free</p>
                </div>
              </div>

              <!-- Hit Rate -->
              <div class="flex items-center gap-3 rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]">
                <div class="rounded-md bg-primary/10 p-2">
                  <Icon name="lucide:activity" class="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Hit Rate</p>
                  <p class="font-medium">{{ (status.statistics?.hit_rate || 0).toFixed(1) }}%</p>
                  <p class="text-xs text-muted-foreground">{{ status.statistics?.hits || 0 }} hits</p>
                </div>
              </div>

              <!-- Cached Scripts -->
              <div class="flex items-center gap-3 rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]">
                <div class="rounded-md bg-primary/10 p-2">
                  <Icon name="lucide:cpu" class="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Cached Scripts</p>
                  <p class="font-medium">{{ status.statistics?.cached_scripts || 0 }}</p>
                  <p class="text-xs text-muted-foreground">of {{ status.statistics?.max_cached_keys || 0 }} max</p>
                </div>
              </div>

              <!-- JIT Buffer -->
              <div v-if="status.jit?.enabled" class="flex items-center gap-3 rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]">
                <div class="rounded-md bg-primary/10 p-2">
                  <Icon name="lucide:zap" class="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">JIT Buffer</p>
                  <p class="font-medium">{{ formatBytes((status.jit?.buffer_size || 0) - (status.jit?.buffer_free || 0)) }}</p>
                  <p class="text-xs text-muted-foreground">{{ formatBytes(status.jit?.buffer_free || 0) }} free</p>
                </div>
              </div>
            </div>
          </template>
        </TabsContent>

        <TabsContent value="configure">
          <form class="space-y-4" @submit.prevent="handleSubmit">
            <div class="max-h-[400px] space-y-4 overflow-y-auto pr-1">
              <!-- Enable OPcache -->
              <div class="flex items-center justify-between rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]">
                <div>
                  <Label class="font-medium">Enable OPcache</Label>
                  <p class="text-xs text-muted-foreground">Cache compiled PHP scripts in memory</p>
                </div>
                <Switch v-model:checked="form.enabled" />
              </div>

              <!-- Enable CLI -->
              <div class="flex items-center justify-between rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]">
                <div>
                  <Label class="font-medium">Enable CLI</Label>
                  <p class="text-xs text-muted-foreground">Enable OPcache for CLI scripts</p>
                </div>
                <Switch v-model:checked="form.enable_cli" />
              </div>

              <!-- Memory Consumption -->
              <div class="space-y-2">
                <Label>Memory Consumption (MB)</Label>
                <Input v-model="form.memory_consumption" type="number" />
                <p class="text-xs text-muted-foreground">Amount of memory for storing precompiled scripts</p>
              </div>

              <!-- Interned Strings Buffer -->
              <div class="space-y-2">
                <Label>Interned Strings Buffer (MB)</Label>
                <Input v-model="form.interned_strings_buffer" type="number" />
                <p class="text-xs text-muted-foreground">Memory for storing interned strings</p>
              </div>

              <!-- Max Accelerated Files -->
              <div class="space-y-2">
                <Label>Max Accelerated Files</Label>
                <Input v-model="form.max_accelerated_files" type="number" />
                <p class="text-xs text-muted-foreground">Maximum number of scripts to cache</p>
              </div>

              <!-- Validate Timestamps -->
              <div class="flex items-center justify-between rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]">
                <div>
                  <Label class="font-medium">Validate Timestamps</Label>
                  <p class="text-xs text-muted-foreground">Check for file changes (disable in production)</p>
                </div>
                <Switch v-model:checked="form.validate_timestamps" />
              </div>

              <!-- Revalidate Frequency -->
              <div v-if="form.validate_timestamps" class="space-y-2">
                <Label>Revalidate Frequency (seconds)</Label>
                <Input v-model="form.revalidate_freq" type="number" />
                <p class="text-xs text-muted-foreground">How often to check for script updates</p>
              </div>

              <!-- Save Comments -->
              <div class="flex items-center justify-between rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]">
                <div>
                  <Label class="font-medium">Save Comments</Label>
                  <p class="text-xs text-muted-foreground">Keep doc comments in cached scripts</p>
                </div>
                <Switch v-model:checked="form.save_comments" />
              </div>

              <!-- JIT Section (PHP 8.0+) -->
              <template v-if="supportsJit">
                <div class="border-t pt-2">
                  <h4 class="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Icon name="lucide:zap" class="h-4 w-4" />
                    JIT Compiler (PHP 8.0+)
                  </h4>
                </div>

                <!-- Enable JIT -->
                <div class="flex items-center justify-between rounded-lg border p-3 dark:border-[#2B2B2B] dark:bg-[#1C1C1C]">
                  <div>
                    <Label class="font-medium">Enable JIT</Label>
                    <p class="text-xs text-muted-foreground">Just-In-Time compilation for better performance</p>
                  </div>
                  <Switch v-model:checked="form.jit_enabled" />
                </div>

                <template v-if="form.jit_enabled">
                  <!-- JIT Buffer Size -->
                  <div class="space-y-2">
                    <Label>JIT Buffer Size</Label>
                    <Input v-model="form.jit_buffer_size" />
                    <p class="text-xs text-muted-foreground">Memory for JIT compiled code (e.g., 100M)</p>
                  </div>

                  <!-- JIT Mode -->
                  <div class="space-y-2">
                    <Label>JIT Mode</Label>
                    <Select v-model="form.jit_mode">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disable">Disable</SelectItem>
                        <SelectItem value="tracing">Tracing (Recommended)</SelectItem>
                        <SelectItem value="function">Function</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </template>
              </template>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" @click="open = false">
                Cancel
              </Button>
              <Button type="submit" :disabled="submitting">
                <Icon v-if="submitting" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
                <Icon v-else name="lucide:settings" class="mr-2 h-4 w-4" />
                Apply Configuration
              </Button>
            </DialogFooter>
          </form>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
