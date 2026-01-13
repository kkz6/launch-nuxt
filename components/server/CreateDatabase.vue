<script setup lang="ts">
import { ref, watch } from 'vue'
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
import { Switch } from '~/components/ui/switch'

interface Props {
  serverId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  created: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const showPassword = ref(false)
const createUser = ref(false)
const hasSubmitted = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const generatePassword = () => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from(crypto.getRandomValues(new Uint32Array(32)))
    .map((x) => charset[x % charset.length])
    .join('')
}

const schema = toTypedSchema(z.object({
  name: z
    .string()
    .min(1, 'Database name is required')
    .max(64)
    .refine((value) => !/\s/.test(value), {
      message: 'Database name cannot contain spaces',
    })
    .refine((value) => /^[a-zA-Z0-9_]+$/.test(value), {
      message: 'Database name can only contain letters, numbers, and underscores',
    }),
  create_user: z.boolean(),
  user_name: z.string().optional(),
  user_password: z.string().optional(),
}).refine((data) => {
  if (data.create_user) {
    return data.user_name && data.user_name.length > 0
  }
  return true
}, {
  message: 'Username is required',
  path: ['user_name'],
}).refine((data) => {
  if (data.create_user && data.user_name) {
    return !/\s/.test(data.user_name)
  }
  return true
}, {
  message: 'Username cannot contain spaces',
  path: ['user_name'],
}).refine((data) => {
  if (data.create_user && data.user_name) {
    return /^[a-zA-Z0-9_]+$/.test(data.user_name)
  }
  return true
}, {
  message: 'Username can only contain letters, numbers, and underscores',
  path: ['user_name'],
}).refine((data) => {
  if (data.create_user) {
    return data.user_password && data.user_password.length > 0
  }
  return true
}, {
  message: 'Password is required',
  path: ['user_password'],
}))

const { handleSubmit, resetForm, setFieldValue, values, errors } = useForm({
  validationSchema: schema,
  initialValues: {
    name: '',
    create_user: false as boolean,
    user_name: '',
    user_password: '',
  },
  validateOnMount: false,
})

type StringFields = 'name' | 'user_name' | 'user_password'
const setStringField = (field: StringFields, value: unknown) => {
  setFieldValue(field, value != null ? String(value) : '', false)
}

const handleCreateUserToggle = (checked: boolean) => {
  createUser.value = checked
  setFieldValue('create_user', checked, false)
}

const submitHandler = handleSubmit(async (data) => {
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

const onSubmit = () => {
  hasSubmitted.value = true
  submitHandler()
}

watch(isOpen, (open) => {
  if (open) {
    // Reset form when dialog opens to clear any stale errors
    resetForm()
    hasSubmitted.value = false
  } else {
    resetForm()
    showPassword.value = false
    createUser.value = false
    hasSubmitted.value = false
  }
})

// Sync createUser with form field
watch(createUser, (val) => {
  setFieldValue('create_user', val, false)
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
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>Create Database</DialogTitle>
        <DialogDescription>
          Create a new MySQL/MariaDB database on this server
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="name">Database Name</Label>
          <Input
            id="name"
            :model-value="values.name"
            placeholder="my_database"
            @update:model-value="setStringField('name', $event)"
          />
          <p v-if="hasSubmitted && errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <div class="flex items-center justify-between rounded-lg border p-4">
          <div class="space-y-0.5">
            <Label>Create User</Label>
            <p class="text-sm text-muted-foreground">
              Create a database user along with the database
            </p>
          </div>
          <Switch
            :checked="createUser"
            @click="createUser = !createUser"
          />
        </div>

        <div v-if="createUser" class="space-y-4">
          <div class="space-y-2">
            <Label for="user_name">Username</Label>
            <Input
              id="user_name"
              :model-value="values.user_name"
              placeholder="my_user"
              autocomplete="off"
              @update:model-value="setStringField('user_name', $event)"
            />
            <p v-if="hasSubmitted && errors.user_name" class="text-sm text-destructive">{{ errors.user_name }}</p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="user_password">Password</Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                class="h-auto p-0 text-xs"
                @click="setFieldValue('user_password', generatePassword(), false)"
              >
                <Icon name="lucide:braces" class="mr-1 h-3 w-3" />
                Generate Password
              </Button>
            </div>
            <div class="relative">
              <Input
                id="user_password"
                :type="showPassword ? 'text' : 'password'"
                :model-value="values.user_password"
                placeholder="Enter password"
                autocomplete="new-password"
                class="pr-10"
                @update:model-value="setStringField('user_password', $event)"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                @click="showPassword = !showPassword"
              >
                <Icon v-if="showPassword" name="lucide:eye-off" class="h-4 w-4" />
                <Icon v-else name="lucide:eye" class="h-4 w-4" />
              </Button>
            </div>
            <p v-if="hasSubmitted && errors.user_password" class="text-sm text-destructive">{{ errors.user_password }}</p>
          </div>
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
