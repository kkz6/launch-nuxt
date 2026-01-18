<script setup lang="ts">
import { toast } from 'vue-sonner'
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

const emit = defineEmits<{
  created: []
}>()

const open = defineModel<boolean>('open', { default: false })
const isLoading = ref(false)
const name = ref('')
const errors = ref<{ name?: string }>({})

const schema = z.object({
  name: z.string().min(1, 'Team name is required'),
})

const canSubmit = computed(() => {
  return name.value.trim().length > 0 && !isLoading.value
})

const resetForm = () => {
  name.value = ''
  errors.value = {}
}

const handleClose = (isOpen: boolean) => {
  if (!isOpen) {
    resetForm()
  }
}

const validate = () => {
  const result = schema.safeParse({ name: name.value.trim() })
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    errors.value = {
      name: fieldErrors.name?.[0],
    }
    return false
  }
  errors.value = {}
  return true
}

const onSubmit = async () => {
  if (!validate()) return

  isLoading.value = true
  try {
    await $api('/teams', {
      method: 'POST',
      body: { name: name.value.trim() },
    })
    toast.success('Team created successfully')
    open.value = false
    resetForm()
    emit('created')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'data' in error) {
      const fetchError = error as { data?: { message?: string } }
      toast.error(fetchError.data?.message || 'Failed to create team')
    } else {
      toast.error('Failed to create team')
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open" @update:open="handleClose">
    <DialogTrigger v-if="$slots.default" as-child>
      <slot />
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create Team</DialogTitle>
        <DialogDescription>
          Create a new team to collaborate with others
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="team-name">Team Name</Label>
          <Input
            id="team-name"
            v-model="name"
            placeholder="My Team"
            autocomplete="off"
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <DialogFooter class="mt-4 sm:justify-start">
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Create Team
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
