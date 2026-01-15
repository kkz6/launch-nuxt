<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface DnsRecord {
  id?: string
  type: string
  name: string
  value: string
  ttl?: number
  priority?: number
  tag?: string
  weight?: number
  port?: number
  flags?: number
  comment?: string
  proxied?: boolean
}

interface Domain {
  id: string
  label: string
  address: string
}

interface Props {
  domain: Domain
  record?: DnsRecord
  availableRecordTypes: string[]
  isCloudflare?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isCloudflare: false,
})

const emit = defineEmits<{
  created: []
  updated: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const selectedType = ref(props.record?.type || 'A')
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const recordSchema = toTypedSchema(
  z.object({
    name: z.string().min(1, 'Name is required'),
    value: z.string().min(1, 'Value is required'),
    ttl: z.coerce.number().optional(),
    comment: z.string().optional(),
    proxied: z.boolean().optional(),
    priority: z.coerce.number().optional(),
    weight: z.coerce.number().optional(),
    port: z.coerce.number().optional(),
    flags: z.coerce.number().optional(),
    tag: z.string().optional(),
  })
)

const { handleSubmit, resetForm, setFieldError, values, setFieldValue } = useForm({
  validationSchema: recordSchema,
  validateOnMount: false,
  initialValues: {
    name: props.record?.name || '',
    value: props.record?.value || '',
    ttl: props.record?.ttl || 3600,
    comment: props.record?.comment || '',
    proxied: props.record?.proxied || false,
    priority: props.record?.priority || 10,
    weight: props.record?.weight || 5,
    port: props.record?.port || 80,
    flags: props.record?.flags || 0,
    tag: props.record?.tag || 'issue',
  },
})

const isProxyableType = computed(() => ['A', 'AAAA', 'CNAME'].includes(selectedType.value))
const showProxyToggle = computed(() => isProxyableType.value && props.isCloudflare)
const showTtlField = computed(() => !(values.proxied && isProxyableType.value && props.isCloudflare))

const handleClose = (open = false) => {
  isOpen.value = open
  if (!open) {
    resetForm()
    selectedType.value = props.record?.type || 'A'
  }
}

const handleTypeChange = (value: unknown) => {
  if (value != null) {
    selectedType.value = String(value)
  }
}

const onSubmit = handleSubmit(async (formValues) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: props.record ? 'Update Record' : 'Create Record',
    description: props.record
      ? 'Are you sure you want to update this DNS record?'
      : 'Are you sure you want to create this DNS record?',
    confirmText: props.record ? 'Update' : 'Create',
    cancelText: 'Cancel',
  })

  if (!result.ok) return

  isLoading.value = true

  const submitData = {
    ...formValues,
    type: props.record?.type || selectedType.value,
    proxied: Boolean(formValues.proxied),
    ttl: formValues.proxied && isProxyableType.value && props.isCloudflare ? 1 : formValues.ttl,
  }

  try {
    if (props.record?.id) {
      await $api(`/dns/domains/${props.domain.id}/records/${props.record.id}`, {
        method: 'POST',
        body: submitData,
      })
      toast.success('Record updated')
      emit('updated')
    } else {
      await $api(`/dns/domains/${props.domain.id}/records`, {
        method: 'POST',
        body: submitData,
      })
      toast.success('Record created')
      emit('created')
    }
    handleClose(false)
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof formValues, messages[0])
      }
    } else {
      toast.error(err.data?.message || 'Failed to save record')
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <SharedConfirmationDialog ref="confirmationDialog" />
  <Dialog v-model:open="isOpen" @update:open="handleClose">
    <DialogTrigger as-child>
      <slot>
        <slot name="trigger">
          <Button v-if="record" variant="ghost" size="icon" class="h-8 w-8">
            <Icon name="lucide:pencil" class="h-4 w-4" />
          </Button>
          <Button v-else>
            <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
            Add Record
          </Button>
        </slot>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>
          {{ record ? `Edit ${record.type} Record` : `Create ${selectedType} Record` }}
        </DialogTitle>
        <DialogDescription>
          {{ record ? 'Update' : 'Create' }} a DNS record for {{ domain.address }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <!-- Record Type Selector (only for new records) -->
        <div v-if="!record && availableRecordTypes.length > 0" class="space-y-2">
          <Label>Record Type</Label>
          <Select :model-value="selectedType" @update:model-value="handleTypeChange">
            <SelectTrigger>
              <SelectValue placeholder="Select record type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="type in availableRecordTypes" :key="type" :value="type">
                {{ type }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="@" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="value">
          <FormItem>
            <FormLabel>Value</FormLabel>
            <FormControl>
              <Input placeholder="192.168.1.1" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <!-- Proxy Toggle (Cloudflare only) -->
        <FormField v-if="showProxyToggle" v-slot="{ value }" name="proxied">
          <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <FormLabel>Proxied</FormLabel>
              <FormDescription>Route traffic through Cloudflare</FormDescription>
            </div>
            <FormControl>
              <Switch :checked="value" @update:checked="(val: boolean) => setFieldValue('proxied', val)" />
            </FormControl>
          </FormItem>
        </FormField>

        <!-- TTL Field -->
        <FormField v-if="showTtlField" v-slot="{ componentField }" name="ttl">
          <FormItem>
            <FormLabel>TTL (seconds)</FormLabel>
            <FormControl>
              <Input type="number" placeholder="3600" :min="60" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <!-- MX specific fields -->
        <FormField v-if="selectedType === 'MX'" v-slot="{ componentField }" name="priority">
          <FormItem>
            <FormLabel>Priority</FormLabel>
            <FormControl>
              <Input type="number" placeholder="10" :min="0" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <!-- SRV specific fields -->
        <template v-if="selectedType === 'SRV'">
          <FormField v-slot="{ componentField }" name="priority">
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <FormControl>
                <Input type="number" placeholder="10" :min="0" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="weight">
            <FormItem>
              <FormLabel>Weight</FormLabel>
              <FormControl>
                <Input type="number" placeholder="5" :min="0" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="port">
            <FormItem>
              <FormLabel>Port</FormLabel>
              <FormControl>
                <Input type="number" placeholder="80" :min="1" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <!-- CAA specific fields -->
        <template v-if="selectedType === 'CAA'">
          <FormField v-slot="{ componentField }" name="flags">
            <FormItem>
              <FormLabel>Flags</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" :min="0" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="tag">
            <FormItem>
              <FormLabel>Tag</FormLabel>
              <FormControl>
                <Input placeholder="issue" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <FormField v-slot="{ componentField }" name="comment">
          <FormItem>
            <FormLabel>Comment (optional)</FormLabel>
            <FormControl>
              <Input placeholder="Add a comment" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <DialogFooter class="mt-4 sm:justify-start">
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ record ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
