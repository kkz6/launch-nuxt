<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'

interface PhpExtension {
  value: string
  label: string
  description: string
  is_installed: boolean
  is_pending: boolean
  status: string
}

interface PhpService {
  id: string
  status: string
  version: string
}

interface PhpVersionData {
  key: string
  display_name: string
  is_installed: boolean
  is_default: boolean
  details?: PhpService
  extensions: PhpExtension[]
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

const loadingStates = ref<Record<string, boolean>>({})
const confirmDialog = ref<{
  open: boolean
  action: 'install' | 'uninstall'
  extension: PhpExtension | null
}>({ open: false, action: 'install', extension: null })

// Format PHP version from "php84" or "8.4" to "8.4"
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

const handleInstall = async (extension: string) => {
  loadingStates.value = { ...loadingStates.value, [extension]: true }
  try {
    await $api(`/servers/${props.serverId}/php/${props.service.details?.id}/extensions`, {
      method: 'POST',
      body: { extension },
    })
    toast.success('Extension installation initiated')
    emit('updated')
  } catch {
    toast.error('Failed to install extension')
  } finally {
    loadingStates.value = { ...loadingStates.value, [extension]: false }
  }
}

const handleUninstall = async (extension: string) => {
  loadingStates.value = { ...loadingStates.value, [extension]: true }
  try {
    await $api(`/servers/${props.serverId}/php/${props.service.details?.id}/extensions/${extension}`, {
      method: 'DELETE',
    })
    toast.success('Extension uninstall initiated')
    emit('updated')
  } catch {
    toast.error('Failed to uninstall extension')
  } finally {
    loadingStates.value = { ...loadingStates.value, [extension]: false }
  }
}

const confirmAction = () => {
  if (confirmDialog.value.extension) {
    if (confirmDialog.value.action === 'install') {
      handleInstall(confirmDialog.value.extension.value)
    } else {
      handleUninstall(confirmDialog.value.extension.value)
    }
  }
  confirmDialog.value = { open: false, action: 'install', extension: null }
}

const pendingCount = computed(() => props.service.extensions?.filter(e => e.is_pending).length || 0)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="lucide:package" class="h-5 w-5" />
          PHP {{ formatPhpVersion(service.details?.version || service.key) }} Extensions
        </DialogTitle>
        <DialogDescription>
          Install or remove PHP extensions.
          <span v-if="pendingCount > 0" class="ml-1 text-amber-600 dark:text-amber-400">
            {{ pendingCount }} in progress...
          </span>
        </DialogDescription>
      </DialogHeader>

      <div class="grid max-h-[400px] gap-2 overflow-y-auto pr-1">
        <div
          v-for="ext in service.extensions"
          :key="ext.value"
          :class="[
            'flex items-center justify-between rounded-lg border p-3',
            'dark:bg-[#1C1C1C] dark:border-[#2B2B2B]',
            ext.is_pending && 'opacity-70',
          ]"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">{{ ext.label }}</span>
              <!-- Status Badge -->
              <Badge v-if="ext.is_pending" variant="secondary" class="gap-1 text-xs">
                <Icon name="lucide:loader-2" class="h-3 w-3 animate-spin" />
                {{ ext.status === 'installing' ? 'Installing' : 'Removing' }}
              </Badge>
              <Badge v-else-if="ext.is_installed" class="gap-1 bg-emerald-600 text-xs">
                <Icon name="lucide:check" class="h-3 w-3" />
                Installed
              </Badge>
              <Badge v-else-if="ext.status === 'failed'" variant="destructive" class="gap-1 text-xs">
                <Icon name="lucide:x" class="h-3 w-3" />
                Failed
              </Badge>
            </div>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">
              {{ ext.description }}
            </p>
          </div>

          <div class="ml-3 flex flex-shrink-0 items-center gap-2">
            <Button
              v-if="ext.is_installed"
              variant="ghost"
              size="sm"
              class="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
              :disabled="loadingStates[ext.value] || ext.is_pending"
              @click="confirmDialog = { open: true, action: 'uninstall', extension: ext }"
            >
              <Icon
                v-if="loadingStates[ext.value] && ext.status === 'uninstalling'"
                name="lucide:loader-2"
                class="h-4 w-4 animate-spin"
              />
              <Icon v-else name="lucide:trash-2" class="h-4 w-4" />
            </Button>
            <Button
              v-else
              variant="outline"
              size="sm"
              class="h-8 text-xs"
              :disabled="loadingStates[ext.value] || ext.is_pending"
              @click="confirmDialog = { open: true, action: 'install', extension: ext }"
            >
              <Icon
                v-if="loadingStates[ext.value] && ext.status === 'installing'"
                name="lucide:loader-2"
                class="mr-1 h-4 w-4 animate-spin"
              />
              <Icon v-else name="lucide:download" class="mr-1 h-3.5 w-3.5" />
              Install
            </Button>
          </div>
        </div>

        <div v-if="!service.extensions?.length" class="py-8 text-center text-muted-foreground">
          No extensions available
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Confirmation Dialog -->
  <AlertDialog :open="confirmDialog.open" @update:open="(open) => confirmDialog = { ...confirmDialog, open }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ confirmDialog.action === 'install' ? 'Install Extension' : 'Uninstall Extension' }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          <template v-if="confirmDialog.action === 'install'">
            Are you sure you want to install <strong>{{ confirmDialog.extension?.label }}</strong> extension?
            This will restart PHP-FPM.
          </template>
          <template v-else>
            Are you sure you want to uninstall <strong>{{ confirmDialog.extension?.label }}</strong> extension?
            This action cannot be undone and will restart PHP-FPM.
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          :class="confirmDialog.action === 'uninstall' ? 'bg-red-600 hover:bg-red-700' : ''"
          @click="confirmAction"
        >
          {{ confirmDialog.action === 'install' ? 'Install' : 'Uninstall' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
