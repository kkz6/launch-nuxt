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
  connected: [server: Server]
}>()

const showDeleteDialog = ref(false)
const isDeleting = ref(false)
const isTryingConnection = ref(false)

// Check if server can be deleted (not during active provisioning)
const canDelete = computed(() => {
  return ['new', 'starting', 'failed', 'awaiting_connection'].includes(props.server.status)
})

// Check if this is a custom server that needs manual provisioning
const isCustomServerPending = computed(() => {
  return props.server.provider === 'custom_server' && props.server.provision_command
})

// Custom servers sit in awaiting_connection until the user pastes the
// provision script and clicks "Try Connection". We don't auto-poll.
const canTryConnection = computed(() => {
  return props.server.status === 'awaiting_connection' && props.server.provider === 'custom_server'
})

// Check if retry provision is available (failed status + connected)
const canRetryProvision = computed(() => {
  return props.server.status === 'failed' && props.server.connected
})

const handleTryConnection = async () => {
  isTryingConnection.value = true
  try {
    await serverService.tryConnection(props.server.id)
    toast.success('Connected — provisioning started')
    emit('connected', props.server)
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Could not reach server. Make sure the provision script ran successfully and try again.')
  } finally {
    isTryingConnection.value = false
  }
}

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
    (canTryConnection || isCustomServerPending) ? 'gap-0' : 'gap-1.5'
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
        Custom-server pending order: Provision script FIRST, Try Connection
        second. Both buttons render side-by-side for an awaiting_connection
        custom server because the workflow is genuinely two steps —
        (1) open the dialog to copy the provision command and run it on the
        target host, then (2) click Try Connection so the platform can
        reach the now-installed agent. The old layout showed only Try
        Connection at this stage and buried Provision in the dots menu,
        which left new users clicking Try Connection on a server they
        never installed the script on. The Provision button uses the
        primary (filled) variant so it reads as "do this first."
      -->
      <Button
        v-if="isCustomServerPending"
        variant="default"
        size="sm"
        :class="[
          'h-7 gap-1.5 px-2.5 text-xs',
          'rounded-r-none border-r-0',
        ]"
        @click.prevent="handleProvision"
      >
        <Icon name="lucide:terminal" class="h-3 w-3" />
        Provision
      </Button>

      <!--
        Try Connection — adjacent to Provision when the server is awaiting
        connection. Outline variant so Provision keeps primary emphasis;
        the user shouldn't reach for this before running the script.
      -->
      <Button
        v-if="canTryConnection"
        variant="outline"
        size="sm"
        :class="[
          'h-7 gap-1.5 px-2.5 text-xs',
          isCustomServerPending ? 'rounded-none border-r-0' : 'rounded-r-none border-r-0',
        ]"
        :disabled="isTryingConnection"
        @click.prevent="handleTryConnection"
      >
        <Icon
          :name="isTryingConnection ? 'lucide:loader-2' : 'lucide:plug-zap'"
          :class="['h-3 w-3', isTryingConnection && 'animate-spin']"
        />
        Try Connection
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
              (canTryConnection || isCustomServerPending) ? 'rounded-l-none' : ''
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
