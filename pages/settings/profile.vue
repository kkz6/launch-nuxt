<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Separator } from '~/components/ui/separator'

definePageMeta({
  layout: 'settings',
  middleware: 'auth',
})

useHead({
  title: 'Profile Settings',
})

const { user, setUser } = useAuth()
const isLoading = ref(false)

const formSchema = toTypedSchema(
  z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
  })
)

const { handleSubmit, errors, defineField, resetForm } = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: user.value?.name || '',
    email: user.value?.email || '',
  },
})

const [name, nameAttrs] = defineField('name')
const [email, emailAttrs] = defineField('email')

// Watch for user changes and reset form
watch(
  user,
  (newUser) => {
    if (newUser) {
      resetForm({
        values: {
          name: newUser.name,
          email: newUser.email,
        },
      })
    }
  },
  { immediate: true }
)

const onSubmit = handleSubmit(async (values) => {
  isLoading.value = true
  try {
    const response = await $api<{ user: import('~/types').User }>('/user/profile', {
      method: 'PUT',
      body: values,
    })
    setUser(response.user)
    toast.success('Profile updated successfully')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'data' in error) {
      const fetchError = error as { data?: { message?: string } }
      toast.error(fetchError.data?.message || 'Failed to update profile')
    } else {
      toast.error('An error occurred')
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">Profile</h3>
      <p class="text-sm text-muted-foreground">
        Update your personal information.
      </p>
    </div>
    <Separator />
    <form class="space-y-8" @submit="onSubmit">
      <div class="space-y-2">
        <Label for="name">Name</Label>
        <Input
          id="name"
          v-model="name"
          v-bind="nameAttrs"
          type="text"
          class="max-w-md"
        />
        <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
      </div>

      <div class="space-y-2">
        <Label for="email">Email</Label>
        <Input
          id="email"
          v-model="email"
          v-bind="emailAttrs"
          type="email"
          class="max-w-md"
        />
        <p v-if="errors.email" class="text-sm text-destructive">{{ errors.email }}</p>
      </div>

      <Button type="submit" :disabled="isLoading">
        <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
        Save changes
      </Button>
    </form>
  </div>
</template>
