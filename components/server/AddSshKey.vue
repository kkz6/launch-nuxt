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
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'

interface Props {
  serverId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  created: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)

const schema = toTypedSchema(z.object({
  name: z.string().min(1, 'Name is required'),
  public_key: z.string().min(1, 'Public key is required').refine(
    (val) => val.startsWith('ssh-rsa') || val.startsWith('ssh-ed25519') || val.startsWith('ecdsa-'),
    'Invalid SSH public key format'
  ),
}))

const { handleSubmit, resetForm, setFieldValue, values, errors } = useForm({
  validationSchema: schema,
  initialValues: {
    name: '',
    public_key: '',
  },
})

type StringFields = 'name' | 'public_key'
const setStringField = (field: StringFields, value: unknown) => {
  setFieldValue(field, value != null ? String(value) : '')
}

const onSubmit = handleSubmit(async (data) => {
  isLoading.value = true
  try {
    await $api(`/servers/${props.serverId}/ssh-keys`, {
      method: 'POST',
      body: data,
    })
    toast.success('SSH key added successfully')
    emit('created')
    isOpen.value = false
    resetForm()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to add SSH key')
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
          <Icon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
          Add SSH Key
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add SSH Key</DialogTitle>
        <DialogDescription>
          Add a new SSH public key to access this server
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit="onSubmit">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input
            id="name"
            :model-value="values.name"
            placeholder="My SSH Key"
            @update:model-value="setStringField('name', $event)"
          />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <div class="space-y-2">
          <Label for="public_key">Public Key</Label>
          <Textarea
            id="public_key"
            :model-value="values.public_key"
            placeholder="ssh-rsa AAAA... or ssh-ed25519 AAAA..."
            rows="4"
            @update:model-value="setStringField('public_key', $event)"
          />
          <p v-if="errors.public_key" class="text-sm text-destructive">{{ errors.public_key }}</p>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Add SSH Key
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
