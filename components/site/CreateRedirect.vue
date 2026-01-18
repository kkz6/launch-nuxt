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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface Redirect {
  id: string
  from: string
  to: string
  type: number
}

interface Props {
  serverId: string
  siteId: string
  redirect?: Redirect
}

const props = defineProps<Props>()

const emit = defineEmits<{
  created: []
  updated: []
}>()

const open = defineModel<boolean>('open', { default: false })
const isLoading = ref(false)
const errors = ref<Record<string, string>>({})

// Form values
const from = ref(props.redirect?.from || '')
const to = ref(props.redirect?.to || '')
const redirectType = ref(props.redirect?.type?.toString() || '301')

const redirectTypes = [
  { value: '301', label: 'Permanent (301)', description: 'Recommended for most cases' },
  { value: '302', label: 'Temporary (302)', description: 'Temporary redirect' },
  { value: '307', label: 'Temporary (307)', description: 'Preserves request method' },
  { value: '308', label: 'Permanent (308)', description: 'Preserves request method' },
]

const schema = z.object({
  from: z.string().min(1, 'From path is required').regex(/^\//, 'Path must start with /'),
  to: z.string().min(1, 'To path or URL is required'),
  type: z.number().refine((val) => [301, 302, 307, 308].includes(val), 'Invalid redirect type'),
})

const canSubmit = computed(() => {
  if (isLoading.value) return false
  if (from.value.trim().length === 0) return false
  if (to.value.trim().length === 0) return false
  return true
})

const resetForm = () => {
  from.value = props.redirect?.from || ''
  to.value = props.redirect?.to || ''
  redirectType.value = props.redirect?.type?.toString() || '301'
  errors.value = {}
}

const validate = () => {
  const result = schema.safeParse({
    from: from.value.trim(),
    to: to.value.trim(),
    type: parseInt(redirectType.value, 10),
  })
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    errors.value = {
      from: fieldErrors.from?.[0] || '',
      to: fieldErrors.to?.[0] || '',
      type: fieldErrors.type?.[0] || '',
    }
    return null
  }
  errors.value = {}
  return result.data
}

const onSubmit = async () => {
  const data = validate()
  if (!data) return

  isLoading.value = true
  try {
    const isEdit = !!props.redirect
    const url = isEdit
      ? `/servers/${props.serverId}/sites/${props.siteId}/redirects/${props.redirect!.id}`
      : `/servers/${props.serverId}/sites/${props.siteId}/redirects`

    await $api(url, {
      method: isEdit ? 'PATCH' : 'POST',
      body: data,
    })

    toast.success(isEdit ? 'Redirect updated' : 'Redirect created')
    open.value = false
    resetForm()
    if (isEdit) {
      emit('updated')
    } else {
      emit('created')
    }
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        errors.value[field] = messages[0]
      }
    } else {
      toast.error(err.data?.message || `Failed to ${props.redirect ? 'update' : 'create'} redirect`)
    }
  } finally {
    isLoading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm()
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Add Redirect
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ redirect ? 'Update Redirect' : 'Create Redirect' }}</DialogTitle>
        <DialogDescription>
          {{ redirect ? 'Update the redirect configuration.' : 'Create a new URL redirect for this site.' }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="from">From Path</Label>
          <Input
            id="from"
            v-model="from"
            placeholder="/old-page"
          />
          <p v-if="errors.from" class="text-sm text-destructive">{{ errors.from }}</p>
          <p class="text-sm text-muted-foreground">The path to redirect from (must start with /)</p>
        </div>

        <div class="space-y-2">
          <Label for="to">To Path or URL</Label>
          <Input
            id="to"
            v-model="to"
            placeholder="/new-page or https://example.com"
          />
          <p v-if="errors.to" class="text-sm text-destructive">{{ errors.to }}</p>
          <p class="text-sm text-muted-foreground">The destination path or full URL</p>
        </div>

        <div class="space-y-2">
          <Label for="type">Redirect Type</Label>
          <Select v-model="redirectType">
            <SelectTrigger>
              <SelectValue placeholder="Select redirect type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="rt in redirectTypes"
                :key="rt.value"
                :value="rt.value"
              >
                <div class="flex flex-col">
                  <span>{{ rt.label }}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.type" class="text-sm text-destructive">{{ errors.type }}</p>
        </div>

        <DialogFooter class="mt-4">
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ redirect ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
