<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
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
const syncLoading = ref(false)
const deleteLoading = ref(false)
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

const syncRecords = async () => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Sync DNS Records',
    description: 'This will fetch the latest DNS records from your provider and update the local cache. Any local changes that were not pushed will be overwritten.',
    confirmText: 'Sync Records',
    cancelText: 'Cancel',
  })

  if (!result.ok) return

  syncLoading.value = true

  try {
    await $api(`/dns/domains/${props.domain.id}/sync`, {
      method: 'POST',
    })
    toast.success('DNS records synced successfully')
    emit('updated')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to sync DNS records')
  } finally {
    syncLoading.value = false
  }
}

const deleteDomain = async () => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Domain',
    description: `Are you sure you want to delete "${props.domain.address}"? This will remove the domain from your dashboard but will not delete the actual DNS records from your provider.`,
    confirmText: 'Delete Domain',
    cancelText: 'Cancel',
    destructive: true,
    helpText: 'Type the domain address to confirm deletion:',
    inputVerificationText: props.domain.address,
  })

  if (!result.ok) return

  deleteLoading.value = true

  try {
    await $api(`/dns/domains/${props.domain.id}`, {
      method: 'DELETE',
    })
    toast.success('Domain deleted')
    emit('deleted')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to delete domain')
  } finally {
    deleteLoading.value = false
  }
}
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="space-y-6">
      <form class="space-y-4" @submit.prevent="onSubmit">
        <FormField v-slot="{ componentField }" name="label">
          <FormItem>
            <FormLabel>Domain Label</FormLabel>
            <FormControl>
              <Input v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <Button type="submit" :disabled="isLoading">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Update Settings
        </Button>
      </form>

      <Separator />

      <div class="space-y-4 pt-2">
        <div>
          <h3 class="text-lg font-medium">Sync DNS Records</h3>
          <p class="text-sm text-muted-foreground">
            Fetch the latest DNS records from your provider. This will update your local cache with the current state of your DNS records.
          </p>
        </div>
        <Button variant="outline" :disabled="syncLoading" @click="syncRecords">
          <Icon v-if="syncLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          <Icon v-else name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
          {{ syncLoading ? 'Syncing...' : 'Sync Records' }}
        </Button>
      </div>

      <Separator />

      <div class="space-y-4 pt-2">
        <div>
          <h3 class="text-lg font-medium text-destructive">Danger Zone</h3>
          <p class="text-sm text-muted-foreground">
            Removing this domain will not delete the actual DNS records from your provider.
            You will need to delete those records manually if needed.
          </p>
        </div>
        <Button variant="destructive" :disabled="deleteLoading" @click="deleteDomain">
          <Icon v-if="deleteLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          <Icon v-else name="lucide:trash-2" class="mr-2 h-4 w-4" />
          Delete Domain
        </Button>
      </div>
    </div>
  </div>
</template>
