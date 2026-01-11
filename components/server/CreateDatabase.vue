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

interface Props {
  serverId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  created: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const schema = toTypedSchema(z.object({
  name: z.string().min(1, 'Database name is required').max(64).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid database name'),
}))

const { handleSubmit, resetForm, setFieldValue, values, errors } = useForm({
  validationSchema: schema,
  initialValues: {
    name: '',
  },
})

const setStringField = (field: 'name', value: unknown) => {
  setFieldValue(field, value != null ? String(value) : '')
}

const onSubmit = handleSubmit(async (data) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Create Database',
    description: `Are you sure you want to create database "${data.name}"?`,
    confirmText: 'Create',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true
  try {
    await $api(`/servers/${props.serverId}/databases`, {
      method: 'POST',
      body: data,
    })
    toast.success('Database created successfully')
    emit('created')
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
          <Icon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
          Create Database
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>Create Database</DialogTitle>
        <DialogDescription>
          Create a new MySQL/MariaDB database on this server
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit="onSubmit">
        <div class="space-y-2">
          <Label for="name">Database Name</Label>
          <Input
            id="name"
            :model-value="values.name"
            placeholder="my_database"
            @update:model-value="setStringField('name', $event)"
          />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Create Database
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
