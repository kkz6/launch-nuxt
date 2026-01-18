<script setup lang="ts">
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import type { FirewallRule } from '~/types'

interface Props {
  serverId: string
  firewallRule?: FirewallRule
}

const props = defineProps<Props>()
const emit = defineEmits<{
  created: []
  updated: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const errors = ref<Record<string, string>>({})
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const actions: Record<string, string> = {
  allow: 'Allow',
  deny: 'Deny',
}

// Form values
const name = ref(props.firewallRule?.name || '')
const action = ref<'allow' | 'deny'>((props.firewallRule?.action as 'allow' | 'deny') || 'allow')
const port = ref(props.firewallRule?.port || '')
const fromIpv4 = ref(props.firewallRule?.from_ipv4 || '')

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  action: z.enum(['allow', 'deny']),
  port: z.string().min(1, 'Port is required'),
  from_ipv4: z.string().optional(),
})

const canSubmit = computed(() => {
  return name.value.trim().length > 0 && port.value.trim().length > 0 && !isLoading.value
})

const resetForm = () => {
  name.value = props.firewallRule?.name || ''
  action.value = (props.firewallRule?.action as 'allow' | 'deny') || 'allow'
  port.value = props.firewallRule?.port || ''
  fromIpv4.value = props.firewallRule?.from_ipv4 || ''
  errors.value = {}
}

const validate = () => {
  const result = schema.safeParse({
    name: name.value.trim(),
    action: action.value,
    port: port.value.trim(),
    from_ipv4: fromIpv4.value.trim() || undefined,
  })
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    errors.value = {
      name: fieldErrors.name?.[0] || '',
      port: fieldErrors.port?.[0] || '',
    }
    return null
  }
  errors.value = {}
  return result.data
}

const onSubmit = async () => {
  const data = validate()
  if (!data) return

  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: props.firewallRule ? 'Update Network Rule' : 'Create Network Rule',
    description: props.firewallRule
      ? 'Are you sure you want to update this firewall rule?'
      : 'Are you sure you want to create this firewall rule?',
    confirmText: props.firewallRule ? 'Update' : 'Create',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true
  try {
    if (props.firewallRule) {
      await $api(`/servers/${props.serverId}/firewall-rules/${props.firewallRule.id}`, {
        method: 'PATCH',
        body: data,
      })
      toast.success('Firewall rule updated successfully')
      emit('updated')
    } else {
      await $api(`/servers/${props.serverId}/firewall-rules`, {
        method: 'POST',
        body: data,
      })
      toast.success('Firewall rule created successfully')
      emit('created')
    }
    isOpen.value = false
    resetForm()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'An error occurred')
  } finally {
    isLoading.value = false
  }
}

watch(isOpen, (open) => {
  if (!open) {
    resetForm()
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot>
        <Button>
          <Icon name="lucide:network" class="mr-2 h-4 w-4" />
          {{ firewallRule ? 'Edit Rule' : 'Add Firewall Rule' }}
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{ firewallRule ? 'Update' : 'Create' }} Network Rule</DialogTitle>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input
            id="name"
            v-model="name"
            placeholder="Enter the name"
          />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <div class="space-y-2">
          <Label>Action</Label>
          <RadioGroup v-model="action" class="flex gap-4">
            <div v-for="(label, value) in actions" :key="value" class="flex items-center space-x-2">
              <RadioGroupItem :id="`action-${value}`" :value="value" />
              <Label :for="`action-${value}`" class="font-normal">{{ label }}</Label>
            </div>
          </RadioGroup>
        </div>

        <div class="space-y-2">
          <Label for="port">Port</Label>
          <Input
            id="port"
            v-model="port"
            placeholder="e.g., 80 or 8080-8090"
          />
          <p v-if="errors.port" class="text-sm text-destructive">{{ errors.port }}</p>
        </div>

        <div class="space-y-2">
          <Label for="from_ipv4">From IP (optional)</Label>
          <Input
            id="from_ipv4"
            v-model="fromIpv4"
            placeholder="e.g., 192.168.1.0/24"
          />
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="!canSubmit">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ firewallRule ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
