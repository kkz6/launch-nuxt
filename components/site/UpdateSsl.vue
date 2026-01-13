<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { Textarea } from '~/components/ui/textarea'
import type { Site } from '~/types'

interface Props {
  serverId: string
  site: Site
  tlsOptions: Record<string, string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updated: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const sslSchema = toTypedSchema(
  z.object({
    tls_setting: z.string(),
    private_key: z.string().optional(),
    certificate: z.string().optional(),
  }).refine(
    (data) => {
      if (data.tls_setting === 'custom') {
        return !!data.private_key || !!data.certificate
      }
      return true
    },
    {
      message: 'Private key and certificate are required for custom SSL',
      path: ['certificate'],
    }
  )
)

const { handleSubmit, values, setFieldError, resetForm } = useForm({
  validationSchema: sslSchema,
  validateOnMount: false,
  initialValues: {
    tls_setting: props.site.tls_setting || 'auto',
    private_key: (props.site as any).activeCertificate?.private_key || '',
    certificate: (props.site as any).activeCertificate?.certificate || '',
  },
})

const tlsLabels: Record<string, { label: string; description: string }> = {
  auto: {
    label: 'Automatic (Let\'s Encrypt)',
    description: 'Automatically obtain and renew SSL certificates from Let\'s Encrypt',
  },
  off: {
    label: 'Disabled',
    description: 'No SSL/TLS encryption. Site will only be accessible via HTTP',
  },
  custom: {
    label: 'Custom Certificate',
    description: 'Use your own SSL certificate and private key',
  },
}

const handleClose = (open = false) => {
  isOpen.value = open
  if (!open) {
    resetForm()
  }
}

const onSubmit = handleSubmit(async (formValues) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Update SSL Settings',
    description: 'Are you sure you want to update SSL settings? This may trigger a certificate reload.',
    confirmText: 'Update',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true

  try {
    await $api(`/servers/${props.serverId}/sites/${props.site.id}/ssl`, {
      method: 'PATCH',
      body: formValues,
    })
    toast.success('SSL settings updated')
    handleClose(false)
    emit('updated')
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof formValues, messages[0])
      }
    } else {
      toast.error(err.data?.message || 'Failed to update SSL settings')
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen" @update:open="handleClose">
    <DialogTrigger as-child>
      <Button>Update SSL</Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-2xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>SSL Certificate Settings</DialogTitle>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <FormField v-slot="{ componentField }" name="tls_setting">
          <FormItem class="space-y-3">
            <FormLabel>Certificate Settings</FormLabel>
            <FormControl>
              <RadioGroup
                v-bind="componentField"
                class="flex flex-col space-y-2"
              >
                <FormItem
                  v-for="(option, key) in tlsLabels"
                  :key="key"
                  class="flex flex-col space-y-0"
                >
                  <div class="flex items-center space-x-3">
                    <FormControl>
                      <RadioGroupItem :value="key" />
                    </FormControl>
                    <FormLabel class="font-normal">
                      {{ option.label }}
                    </FormLabel>
                  </div>
                  <FormDescription class="ml-7">
                    {{ option.description }}
                  </FormDescription>
                </FormItem>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <template v-if="values.tls_setting === 'custom'">
          <FormField v-slot="{ componentField }" name="private_key">
            <FormItem>
              <FormLabel>Private Key</FormLabel>
              <FormControl>
                <Textarea
                  class="h-36 font-mono text-sm"
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="certificate">
            <FormItem>
              <FormLabel>Certificate</FormLabel>
              <FormControl>
                <Textarea
                  class="h-36 font-mono text-sm"
                  placeholder="-----BEGIN CERTIFICATE-----"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <Button type="submit" :disabled="isLoading">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Update SSL
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>
