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
} from '~/components/ui/dialog'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Input } from '~/components/ui/input'

interface Props {
  teamId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  invited: []
}>()

const open = defineModel<boolean>('open', { required: true })
const isLoading = ref(false)

const roles = [
  { value: 'editor', label: 'Editor' },
  { value: 'developer', label: 'Developer' },
  { value: 'viewer', label: 'Viewer' },
]

const formSchema = toTypedSchema(
  z.object({
    email: z.string().email('Please enter a valid email'),
    role: z.string().min(1, 'Please select a role'),
  })
)

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    email: '',
    role: 'viewer',
  },
  validateOnMount: false,
})

const handleClose = (isOpen: boolean) => {
  if (!isOpen) {
    form.resetForm()
  }
}

const onSubmit = form.handleSubmit(async (values) => {
  if (!props.teamId) return

  isLoading.value = true
  try {
    await $api(`/teams/${props.teamId}/invitations`, {
      method: 'POST',
      body: values,
    })
    toast.success('Invitation sent')
    open.value = false
    form.resetForm()
    emit('invited')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'data' in error) {
      const fetchError = error as { data?: { message?: string } }
      toast.error(fetchError.data?.message || 'Failed to send invitation')
    } else {
      toast.error('Failed to send invitation')
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="open" @update:open="handleClose">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Invite Member</DialogTitle>
        <DialogDescription>
          Send an invitation to join your team
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <FormField v-slot="{ componentField }" name="email">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input type="email" placeholder="colleague@example.com" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="role">
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem v-for="role in roles" :key="role.value" :value="role.value">
                  {{ role.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>

        <DialogFooter class="mt-4">
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Send Invitation
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
