<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

definePageMeta({
  layout: 'guest',
  middleware: 'guest',
})

useHead({
  title: 'Sign up',
})

const { register, isLoading } = useAuth()

const formSchema = toTypedSchema(
  z
    .object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      email: z.string().email('Please enter a valid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      password_confirmation: z.string(),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: 'Passwords do not match',
      path: ['password_confirmation'],
    })
)

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  },
})

const [name, nameAttrs] = defineField('name')
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')
const [passwordConfirmation, passwordConfirmationAttrs] = defineField('password_confirmation')

const onSubmit = handleSubmit(async (values) => {
  try {
    await register(values)
    toast.success('Account created successfully')
    navigateTo('/dashboard')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'data' in error) {
      const fetchError = error as {
        data?: { message?: string; errors?: Record<string, string[]> }
      }
      if (fetchError.data?.errors) {
        Object.values(fetchError.data.errors).forEach((messages) => {
          messages.forEach((msg) => toast.error(msg))
        })
      } else {
        toast.error(fetchError.data?.message || 'Registration failed')
      }
    } else {
      toast.error('An error occurred during registration')
    }
  }
})
</script>

<template>
  <div>
    <div class="mb-8 flex items-center">
      <NuxtLink to="/" class="text-2xl font-bold">launchctl</NuxtLink>
    </div>

    <h3 class="mb-2 text-lg font-semibold text-foreground">Create an account</h3>
    <p class="mb-8 text-sm text-muted-foreground">
      Already have an account?
      <NuxtLink to="/login" class="font-medium text-primary hover:text-primary/90">
        Sign in
      </NuxtLink>
    </p>

    <form class="space-y-4" @submit="onSubmit">
      <div class="space-y-2">
        <Label for="name">Name</Label>
        <Input
          id="name"
          v-model="name"
          v-bind="nameAttrs"
          type="text"
          placeholder="John Doe"
          autocomplete="name"
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
          placeholder="m@example.com"
          autocomplete="email"
        />
        <p v-if="errors.email" class="text-sm text-destructive">{{ errors.email }}</p>
      </div>

      <div class="space-y-2">
        <Label for="password">Password</Label>
        <Input
          id="password"
          v-model="password"
          v-bind="passwordAttrs"
          type="password"
          autocomplete="new-password"
        />
        <p v-if="errors.password" class="text-sm text-destructive">{{ errors.password }}</p>
      </div>

      <div class="space-y-2">
        <Label for="password_confirmation">Confirm Password</Label>
        <Input
          id="password_confirmation"
          v-model="passwordConfirmation"
          v-bind="passwordConfirmationAttrs"
          type="password"
          autocomplete="new-password"
        />
        <p v-if="errors.password_confirmation" class="text-sm text-destructive">
          {{ errors.password_confirmation }}
        </p>
      </div>

      <Button type="submit" class="w-full" :disabled="isLoading">
        <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
        {{ isLoading ? 'Creating account...' : 'Create account' }}
      </Button>
    </form>
  </div>
</template>
