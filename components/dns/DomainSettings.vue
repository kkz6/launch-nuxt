<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'
import { Input } from '~/components/ui/input'

interface Domain {
  id: string
  label: string
  address: string
  provider?: {
    provider: string
    provider_label: string
  }
}

interface Props {
  domain: Domain
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updated: []
  deleted: []
}>()

const isLoading = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const domainSchema = toTypedSchema(
  z.object({
    label: z.string().min(1, 'Label is required'),
  })
)

const { handleSubmit, setFieldError } = useForm({
  validationSchema: domainSchema,
  validateOnMount: false,
  initialValues: {
    label: props.domain.label,
  },
})

const onSubmit = handleSubmit(async (values) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Update Domain',
    description: 'Are you sure you want to update this domain?',
    confirmText: 'Update',
    cancelText: 'Cancel',
  })

  if (!result.ok) return

  isLoading.value = true

  try {
    await $api(`/dns/domains/${props.domain.id}`, {
      method: 'PATCH',
      body: values,
    })
    toast.success('Domain updated')
    emit('updated')
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof values, messages[0])
      }
    } else {
      toast.error(err.data?.message || 'Failed to update domain')
    }
  } finally {
    isLoading.value = false
  }
})

const deleteDomain = async () => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Domain',
    description: `Are you sure you want to delete "${props.domain.label}"? This will not delete the actual DNS records from your provider.`,
    confirmText: 'Delete Domain',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/dns/domains/${props.domain.id}`, {
        method: 'DELETE',
      })
      toast.success('Domain deleted')
      emit('deleted')
    } catch {
      toast.error('Failed to delete domain')
    }
  }
}
</script>

<template>
  <Card class="bg-background">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <CardHeader>
      <CardTitle class="text-xl">Domain Settings</CardTitle>
      <CardDescription>
        Manage settings for {{ domain.address }}
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <form class="space-y-4" @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="label">
          <FormItem>
            <FormLabel>Domain Label</FormLabel>
            <FormControl>
              <Input v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <div class="space-y-2">
          <FormLabel>Domain Address</FormLabel>
          <Input :model-value="domain.address" disabled />
          <p class="text-sm text-muted-foreground">
            The domain address cannot be changed
          </p>
        </div>

        <div class="space-y-2">
          <FormLabel>DNS Provider</FormLabel>
          <Input :model-value="domain.provider?.provider_label || 'Unknown'" disabled />
          <p class="text-sm text-muted-foreground">
            The DNS provider cannot be changed. To use a different provider, delete this domain and add it again.
          </p>
        </div>

        <Button type="submit" :disabled="isLoading">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Update Settings
        </Button>
      </form>

      <Separator />

      <div class="space-y-4 pt-2">
        <div>
          <h3 class="text-lg font-medium text-destructive">Danger Zone</h3>
          <p class="text-sm text-muted-foreground">
            Removing this domain will not delete the actual DNS records from your provider.
            You will need to delete those records manually if needed.
          </p>
        </div>
        <Button variant="destructive" @click="deleteDomain">
          <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
          Delete Domain
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
