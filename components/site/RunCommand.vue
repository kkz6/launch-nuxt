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

interface Props {
  serverId: string
  siteId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  executed: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const commandSchema = toTypedSchema(
  z.object({
    command: z.string().min(1, 'Command is required').max(255),
  })
)

const { handleSubmit, resetForm, setFieldError } = useForm({
  validationSchema: commandSchema,
  initialValues: {
    command: '',
  },
})

const handleClose = (open = false) => {
  isOpen.value = open
  if (!open) {
    resetForm()
  }
}

const onSubmit = handleSubmit(async (values) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Run Command',
    description: `Are you sure you want to execute: ${values.command}?`,
    confirmText: 'Run',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true

  try {
    await $api(`/servers/${props.serverId}/sites/${props.siteId}/commands`, {
      method: 'POST',
      body: values,
    })
    toast.success('Command execution started')
    handleClose(false)
    emit('executed')
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof values, messages[0])
      }
    } else {
      toast.error(err.data?.message || 'Failed to run command')
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen" @update:open="handleClose">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:terminal" class="mr-2 h-4 w-4" />
        Run Command
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>Run SSH Command</DialogTitle>
        <DialogDescription>
          Execute an SSH command on this site. The command will run in the site's directory.
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="command">
          <FormItem>
            <FormLabel>Command</FormLabel>
            <FormControl>
              <div class="relative">
                <Input
                  class="pl-9"
                  placeholder="php artisan migrate --force"
                  v-bind="componentField"
                />
                <div class="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground/80">
                  <Icon name="lucide:terminal" class="h-4 w-4" />
                </div>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <DialogFooter>
          <Button variant="outline" type="button" @click="handleClose(false)">Cancel</Button>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Run Command
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
