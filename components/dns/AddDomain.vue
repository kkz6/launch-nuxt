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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface DnsProvider {
  id: string;
  provider: string;
  label: string;
}

interface Props {
  providers: DnsProvider[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  created: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)

const domainSchema = toTypedSchema(
  z.object({
    label: z.string().min(1, 'Label is required'),
    address: z.string().min(1, 'Domain address is required'),
    provider: z.string().min(1, 'Provider is required'),
  })
)

const { handleSubmit, resetForm, setFieldError } = useForm({
  validationSchema: domainSchema,
  initialValues: {
    label: '',
    address: '',
    provider: '',
  },
})

const handleClose = (open = false) => {
  isOpen.value = open
  if (!open) {
    resetForm()
  }
}

const onSubmit = handleSubmit(async (values) => {
  isLoading.value = true

  try {
    await $api('/dns/domains', {
      method: 'POST',
      body: values,
    })
    toast.success('Domain added successfully')
    handleClose(false)
    emit('created')
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof values, messages[0])
      }
    } else {
      toast.error(err.data?.message || 'Failed to add domain')
    }
  } finally {
    isLoading.value = false
  }
})

const providerOptions = computed(() =>
  props.providers.map((p) => ({ value: p.id, label: p.label }))
);
</script>

<template>
  <Dialog v-model:open="isOpen" @update:open="handleClose">
    <DialogTrigger as-child>
      <slot>
        <Button>
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Add Domain
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Add Domain</DialogTitle>
        <DialogDescription>
          Add a new domain to manage its DNS records
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="label">
          <FormItem>
            <FormLabel>Label</FormLabel>
            <FormControl>
              <Input placeholder="My Website" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="address">
          <FormItem>
            <FormLabel>Domain Address</FormLabel>
            <FormControl>
              <Input placeholder="example.com" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="provider">
          <FormItem>
            <FormLabel>DNS Provider</FormLabel>
            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem
                  v-for="option in providerOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>

        <DialogFooter class="mt-4 sm:justify-start">
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Add Domain
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
