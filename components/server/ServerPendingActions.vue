<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
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
import type { Server } from '~/types'
import { serverService } from '~/services/serverService'

interface Props {
  server: Server
}

const props = defineProps<Props>()

const emit = defineEmits<{
  provision: [server: Server]
  deleted: [serverId: string]
  viewLogs: [server: Server]
  retryProvision: [server: Server]
}>()

const showDeleteDialog = ref(false)
const isDeleting = ref(false)

// Check if server can be deleted (not during active provisioning)
const canDelete = computed(() => {
  return ['new', 'starting', 'failed'].includes(props.server.status)
})

// Check if this is a custom server that needs manual provisioning
const isCustomServerPending = computed(() => {
  return props.server.provider === 'custom_server' && props.server.provision_command
})

// Check if retry provision is available (failed status + connected)
const canRetryProvision = computed(() => {
  return props.server.status === 'failed' && props.server.connected
})

const handleProvision = () => {
  emit('provision', props.server)
}

const handleRetryProvision = () => {
  emit('retryProvision', props.server)
}

const handleViewLogs = () => {
  emit('viewLogs', props.server)
}

const handleDelete = async () => {
  isDeleting.value = true
  try {
    await serverService.delete(props.server.id)
    toast.success('Server deleted successfully')
    emit('deleted', props.server.id)
    showDeleteDialog.value = false
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to delete server')
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="pointer-events-auto flex items-center">
    <!-- Primary Provision Button (for custom servers) -->
    <Button
      v-if="isCustomServerPending"
      variant="outline"
      size="sm"
      class="h-7 gap-1.5 rounded-r-none border-r-0 px-2.5 text-xs"
      @click.prevent="handleProvision"
    >
      <Icon name="lucide:terminal" class="h-3 w-3" />
      Provision
    </Button>

    <!-- Dropdown Menu -->
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="outline"
          size="sm"
          :class="[
            'h-7 w-7 p-0',
            isCustomServerPending ? 'rounded-l-none' : ''
          ]"
          @click.prevent
        >
          <Icon name="lucide:chevron-down" class="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-40">
        <!-- Provision option (shown for non-custom servers or as backup) -->
        <DropdownMenuItem
          v-if="isCustomServerPending"
          @click.prevent="handleProvision"
        >
          <Icon name="lucide:terminal" class="mr-2 h-4 w-4" />
          Provision
        </DropdownMenuItem>

        <!-- View Logs -->
        <DropdownMenuItem @click.prevent="handleViewLogs">
          <Icon name="lucide:scroll-text" class="mr-2 h-4 w-4" />
          View Logs
        </DropdownMenuItem>

        <!-- Retry Provision (only for failed servers that connected) -->
        <DropdownMenuItem
          v-if="canRetryProvision"
          @click.prevent="handleRetryProvision"
        >
          <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
          Retry Provision
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <!-- Delete -->
        <DropdownMenuItem
          :disabled="!canDelete"
          class="text-destructive focus:text-destructive"
          @click.prevent="showDeleteDialog = true"
        >
          <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Delete Confirmation Dialog -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Server</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{{ server.name }}</strong>?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">Cancel</AlertDialogCancel>
          <AlertDialogAction
            :disabled="isDeleting"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click.prevent="handleDelete"
          >
            <Icon
              v-if="isDeleting"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
