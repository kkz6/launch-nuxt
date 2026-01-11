<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
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

interface DatabaseUser {
  id: string
  name: string
  password?: string
  databaseIds?: string[]
}

interface Props {
  serverId: string
  databases: Record<string, string>
  user?: DatabaseUser
  open?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  created: []
  updated: []
  'update:open': [value: boolean]
}>()

const isOpen = ref(props.open ?? false)

// Sync with external v-model:open
watch(() => props.open, (value) => {
  if (value !== undefined) {
    isOpen.value = value
  }
})

watch(isOpen, (value) => {
  emit('update:open', value)
})
const isLoading = ref(false)
const showPassword = ref(false)
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
    .min(1, 'Username is required')
    .max(32)
    .refine((value) => !/\s/.test(value), {
      message: 'Username cannot contain spaces',
    })
    .refine((value) => /^[a-zA-Z0-9_]+$/.test(value), {
      message: 'Username can only contain letters, numbers, and underscores',
    }),
  password: z.string().min(1, 'Password is required'),
  databases: z.array(z.string()).refine((value) => value.length > 0, {
    message: 'At least one database must be selected',
  }),
}))

const { handleSubmit, resetForm, setFieldValue, values, errors } = useForm({
  validationSchema: schema,
  initialValues: {
    name: props.user?.name ?? '',
    password: props.user?.password ?? '',
    databases: props.user?.databaseIds ?? [],
  },
  validateOnMount: false,
})

type StringFields = 'name' | 'password'
const setStringField = (field: StringFields, value: unknown) => {
  setFieldValue(field, value != null ? String(value) : '', false)
}

const toggleDatabase = (databaseId: string, checked: boolean) => {
  const current = values.databases ?? []
  if (checked) {
    setFieldValue('databases', [...current, databaseId], false)
  } else {
    setFieldValue('databases', current.filter((id: string) => id !== databaseId), false)
  }
}

const isUpdate = computed(() => Boolean(props.user))
const isRootUser = computed(() => props.user?.name === 'root')

const submitHandler = handleSubmit(async (data) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: isUpdate.value ? 'Update Database User' : 'Create Database User',
    description: isUpdate.value
      ? `Are you sure you want to update user "${data.name}"?`
      : `Are you sure you want to create user "${data.name}"?`,
    confirmText: isUpdate.value ? 'Update' : 'Create',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true
  try {
    if (isUpdate.value && props.user) {
      await $api(`/servers/${props.serverId}/database-users/${props.user.id}`, {
        method: 'PATCH',
        body: data,
      })
      toast.success('Database user updated successfully')
      emit('updated')
    } else {
      await $api(`/servers/${props.serverId}/database-users`, {
        method: 'POST',
        body: data,
      })
      toast.success('Database user created successfully')
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

const onSubmit = () => {
  hasSubmitted.value = true
  submitHandler()
}

watch(isOpen, (open) => {
  if (open) {
    // Reset form with user data when opening
    resetForm({
      values: {
        name: props.user?.name ?? '',
        password: props.user?.password ?? '',
        databases: props.user?.databaseIds ?? [],
      },
    })
    hasSubmitted.value = false
  } else {
    showPassword.value = false
    hasSubmitted.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger v-if="!user" as-child>
      <slot>
        <Button>
          <Icon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
          Create User
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{ isUpdate ? 'Update Database User' : 'Create Database User' }}</DialogTitle>
        <DialogDescription>
          {{ isUpdate ? 'Update an existing database user on this server' : 'Create a new database user on this server' }}
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit="onSubmit">
        <div class="space-y-2">
          <Label for="name">Username</Label>
          <Input
            id="name"
            :model-value="values.name"
            placeholder="my_user"
            autocomplete="off"
            @update:model-value="setStringField('name', $event)"
          />
          <p v-if="hasSubmitted && errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="password">Password</Label>
            <Button
              type="button"
              variant="link"
              size="sm"
              class="h-auto p-0 text-xs"
              @click="setFieldValue('password', generatePassword(), false)"
            >
              <Icon name="lucide:braces" class="mr-1 h-3 w-3" />
              Generate Password
            </Button>
          </div>
          <div class="relative">
            <Input
              id="password"
              :type="showPassword ? 'text' : 'password'"
              :model-value="values.password"
              placeholder="Enter password"
              autocomplete="new-password"
              class="pr-10"
              @update:model-value="setStringField('password', $event)"
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
          <p v-if="hasSubmitted && errors.password" class="text-sm text-destructive">{{ errors.password }}</p>
        </div>

        <div class="space-y-4">
          <div class="space-y-1">
            <Label>Allowed Databases</Label>
            <p class="text-sm text-muted-foreground">
              {{ isRootUser ? 'Root user has access to all databases' : 'Select which databases this user can access' }}
            </p>
          </div>
          <div v-if="Object.keys(databases).length === 0" class="text-sm text-muted-foreground">
            No databases available. Create a database first.
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="(name, id) in databases"
              :key="id"
              class="flex items-center space-x-3"
            >
              <Checkbox
                :id="`db-${id}`"
                :checked="values.databases?.includes(String(id))"
                :disabled="isRootUser"
                @update:checked="toggleDatabase(String(id), $event as boolean)"
              />
              <Label :for="`db-${id}`" class="font-normal cursor-pointer">
                {{ name }}
              </Label>
            </div>
          </div>
          <p v-if="hasSubmitted && errors.databases" class="text-sm text-destructive">{{ errors.databases }}</p>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ isUpdate ? 'Update User' : 'Create User' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
