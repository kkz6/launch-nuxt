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
  return ['new', 'starting', 'failed', 'awaiting_connection'].includes(props.server.status)
})

// Check if this is a custom server that needs manual provisioning.
// Drives the Provision button on the card; the dialog it opens now
// owns the Try Connection step as well.
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
  <div :class="[
    'pointer-events-auto flex items-center',
    isCustomServerPending ? 'gap-0' : 'gap-1.5'
  ]">
    <!-- Failed servers get inline, discoverable actions. View logs is the
         primary affordance (it opens the friendly error sheet with the
         Try-again / Manage-credentials buttons), Delete is destructive and
         confirmed in a dialog. Hiding these behind a dots menu tested badly
         — users didn't notice them at all. -->
    <template v-if="server.status === 'failed'">
      <Button
        variant="outline"
        size="sm"
        class="h-7 gap-1.5 px-2.5 text-xs"
        @click.prevent="handleViewLogs"
      >
        <Icon name="lucide:scroll-text" class="h-3 w-3" />
        View details
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="h-7 gap-1.5 border-destructive/30 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
        @click.prevent="showDeleteDialog = true"
      >
        <Icon name="lucide:trash-2" class="h-3 w-3" />
        Delete
      </Button>
    </template>

    <!-- All other transitional states (new, starting, custom-server pending)
         keep the compact dots menu so the card doesn't grow taller. -->
    <template v-else>
      <!--
        Single Provision button for custom servers awaiting connection.
        Try Connection lives inside the dialog this opens — the user
        copies the command, runs it on their box, and clicks Try
        Connection right there without ever leaving the dialog. Keeping
        both actions in one workflow surface stops new users from
        clicking Try Connection on the card before they've even seen
        the script they were supposed to run.
      -->
      <Button
        v-if="isCustomServerPending"
        variant="default"
        size="sm"
        class="h-7 gap-1.5 rounded-r-none border-r-0 px-2.5 text-xs"
        @click.prevent="handleProvision"
      >
        <Icon name="lucide:terminal" class="h-3 w-3" />
        Provision
      </Button>

      <!-- Dropdown Menu — uses the conventional "more actions" dots icon
           instead of a generic chevron-down, which read as an "expand row"
           affordance in user testing. -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            :class="[
              'h-7 w-7 p-0',
              isCustomServerPending ? 'rounded-l-none' : ''
            ]"
            aria-label="More actions"
            title="More actions"
            @click.prevent
          >
            <Icon name="lucide:more-horizontal" class="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-40">
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
    </template>

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
