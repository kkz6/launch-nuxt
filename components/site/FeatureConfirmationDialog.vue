<script setup lang="ts">
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
import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label'

interface Props {
  open: boolean
  featureId: string
  featureName: string
  action: 'enable' | 'disable'
  queueCount: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [options: { delete_queues?: boolean; configure_env?: boolean; update_caddyfile?: boolean }]
}>()

const deleteQueues = ref(true)
const configureEnv = ref(true)
const updateCaddyfile = ref(true)

const dialogTitle = computed(() => {
  return `${props.action === 'enable' ? 'Enable' : 'Disable'} ${props.featureName}`
})

const dialogDescription = computed(() => {
  if (props.action === 'enable') {
    switch (props.featureId) {
      case 'horizon':
        return 'Horizon replaces standard queue workers with a Redis-powered dashboard. Queue workers and Horizon cannot run simultaneously.'
      case 'reverb':
        return 'Reverb provides a WebSocket server for real-time broadcasting.'
      case 'inertia':
        return 'This will enable server-side rendering for Inertia.js applications.'
      default:
        return `This will enable ${props.featureName} for your site.`
    }
  }

  return `This will disable ${props.featureName} for your site.`
})

const showDeleteQueuesOption = computed(() => {
  return props.featureId === 'horizon' && props.action === 'enable' && props.queueCount > 0
})

const showConfigureEnvOption = computed(() => {
  return props.featureId === 'reverb' && props.action === 'enable'
})

const showUpdateCaddyfileOption = computed(() => {
  return props.featureId === 'reverb' && props.action === 'enable'
})

function handleConfirm() {
  const options: { delete_queues?: boolean; configure_env?: boolean; update_caddyfile?: boolean } = {}

  if (showDeleteQueuesOption.value) {
    options.delete_queues = deleteQueues.value
  }

  if (showConfigureEnvOption.value) {
    options.configure_env = configureEnv.value
  }

  if (showUpdateCaddyfileOption.value) {
    options.update_caddyfile = updateCaddyfile.value
  }

  emit('confirm', options)
  emit('update:open', false)
}

function handleClose(open: boolean) {
  emit('update:open', open)
}
</script>

<template>
  <AlertDialog :open="open" @update:open="handleClose">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ dialogTitle }}</AlertDialogTitle>
        <AlertDialogDescription>{{ dialogDescription }}</AlertDialogDescription>
      </AlertDialogHeader>

      <div v-if="showDeleteQueuesOption || showConfigureEnvOption || showUpdateCaddyfileOption" class="space-y-3 py-2">
        <div v-if="showDeleteQueuesOption" class="flex items-center gap-2">
          <Checkbox
            id="delete-queues"
            :checked="deleteQueues"
            @update:checked="deleteQueues = !!$event"
          />
          <Label for="delete-queues" class="text-sm font-normal">
            Delete existing queue workers ({{ queueCount }} {{ queueCount === 1 ? 'worker' : 'workers' }})
          </Label>
        </div>

        <div v-if="showConfigureEnvOption" class="flex items-center gap-2">
          <Checkbox
            id="configure-env"
            :checked="configureEnv"
            @update:checked="configureEnv = !!$event"
          />
          <Label for="configure-env" class="text-sm font-normal">
            Configure .env variables (sets BROADCAST_CONNECTION=reverb and generates Reverb keys)
          </Label>
        </div>

        <div v-if="showUpdateCaddyfileOption" class="flex items-center gap-2">
          <Checkbox
            id="update-caddyfile"
            :checked="updateCaddyfile"
            @update:checked="updateCaddyfile = !!$event"
          />
          <Label for="update-caddyfile" class="text-sm font-normal">
            Update Caddyfile (adds WebSocket reverse proxy for Reverb)
          </Label>
        </div>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="handleConfirm">
          {{ action === 'enable' ? 'Enable' : 'Disable' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
