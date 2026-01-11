<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
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
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const actions: Record<string, string> = {
  allow: 'Allow',
  deny: 'Deny',
}

const schema = toTypedSchema(z.object({
  name: z.string().min(1, 'Name is required').max(255),
  action: z.enum(['allow', 'deny']),
  port: z.string().min(1, 'Port is required'),
  from_ipv4: z.string().optional(),
}))

const { handleSubmit, resetForm, setFieldValue, values, errors } = useForm({
  validationSchema: schema,
  initialValues: {
    name: props.firewallRule?.name || '',
    action: (props.firewallRule?.action as 'allow' | 'deny') || 'allow',
    port: props.firewallRule?.port || '',
    from_ipv4: props.firewallRule?.from_ipv4 || '',
  },
})

type StringFields = 'name' | 'port' | 'from_ipv4'
const setStringField = (field: StringFields, value: unknown) => {
  setFieldValue(field, value != null ? String(value) : '')
}

const onSubmit = handleSubmit(async (data) => {
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
})

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
      <form class="grid w-full gap-4" @submit="onSubmit">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input
            id="name"
            :model-value="values.name"
            placeholder="Enter the name"
            @update:model-value="setStringField('name', $event)"
          />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <div class="space-y-2">
          <Label>Action</Label>
          <RadioGroup
            :model-value="values.action"
            class="flex gap-4"
            @update:model-value="setFieldValue('action', $event as 'allow' | 'deny')"
          >
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
            :model-value="values.port"
            placeholder="e.g., 80 or 8080-8090"
            @update:model-value="setStringField('port', $event)"
          />
          <p v-if="errors.port" class="text-sm text-destructive">{{ errors.port }}</p>
        </div>

        <div class="space-y-2">
          <Label for="from_ipv4">From IP (optional)</Label>
          <Input
            id="from_ipv4"
            :model-value="values.from_ipv4"
            placeholder="e.g., 192.168.1.0/24"
            @update:model-value="setStringField('from_ipv4', $event)"
          />
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ firewallRule ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
