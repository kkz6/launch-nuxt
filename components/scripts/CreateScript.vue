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
import { Textarea } from '~/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'

interface Script {
  id: string
  name: string
  user: string
  script: string
  team_id: string | null
}

interface Props {
  script?: Script
}

const props = defineProps<Props>()

const emit = defineEmits<{
  created: []
  updated: []
}>()

const open = defineModel<boolean>('open', { default: false })
const isLoading = ref(false)
const errors = ref<Record<string, string>>({})

const { user: authUser } = useAuth()
const teamId = computed(() => authUser.value?.current_team_id?.toString() || null)

// Form values
const name = ref(props.script?.name || '')
const user = ref(props.script?.user || 'root')
const scriptContent = ref(props.script?.script || '')
const shareWithTeam = ref(props.script?.team_id !== null)

const users = [
  { value: 'root', label: 'root' },
  { value: 'launch', label: 'launch' },
]

const schema = z.object({
  name: z.string().min(1, 'Script name is required').max(255),
  user: z.string().min(1, 'User is required'),
  script: z.string().min(1, 'Script content is required'),
})

const canSubmit = computed(() => {
  if (isLoading.value) return false
  if (name.value.trim().length === 0) return false
  if (user.value.length === 0) return false
  if (scriptContent.value.trim().length === 0) return false
  return true
})

const resetForm = () => {
  name.value = props.script?.name || ''
  user.value = props.script?.user || 'root'
  scriptContent.value = props.script?.script || ''
  shareWithTeam.value = props.script?.team_id !== null
  errors.value = {}
}

const validate = () => {
  const result = schema.safeParse({
    name: name.value.trim(),
    user: user.value,
    script: scriptContent.value,
  })
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    errors.value = {
      name: fieldErrors.name?.[0] || '',
      user: fieldErrors.user?.[0] || '',
      script: fieldErrors.script?.[0] || '',
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
    const isEdit = !!props.script
    const url = isEdit ? `/scripts/${props.script!.id}` : '/scripts'

    await $api(url, {
      method: isEdit ? 'PATCH' : 'POST',
      body: {
        ...data,
        team_id: shareWithTeam.value ? teamId.value : null,
      },
    })

    toast.success(isEdit ? 'Script updated' : 'Script created')
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
      toast.error(err.data?.message || `Failed to ${props.script ? 'update' : 'create'} script`)
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

// Placeholder variables info
const variablesInfo = [
  { var: '{{server_id}}', desc: 'Server ID' },
  { var: '{{server_name}}', desc: 'Server name' },
  { var: '{{ip_address}}', desc: 'Public IP address' },
  { var: '{{private_ip_address}}', desc: 'Private IP address' },
  { var: '{{username}}', desc: 'Executing user' },
  { var: '{{db_password}}', desc: 'Database password' },
  { var: '{{server_type}}', desc: 'Server type' },
]
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Create Script
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ script ? 'Update Script' : 'Create Script' }}</DialogTitle>
        <DialogDescription>
          {{ script ? 'Update the script configuration.' : 'Create a reusable script to run across your servers.' }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input
              id="name"
              v-model="name"
              placeholder="Update packages"
            />
            <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
          </div>

          <div class="space-y-2">
            <Label for="user">Run As User</Label>
            <Select v-model="user">
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="u in users"
                  :key="u.value"
                  :value="u.value"
                >
                  {{ u.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="errors.user" class="text-sm text-destructive">{{ errors.user }}</p>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="script">Script</Label>
          <Textarea
            id="script"
            v-model="scriptContent"
            placeholder="#!/bin/bash&#10;&#10;apt update && apt upgrade -y"
            class="min-h-[200px] font-mono text-sm"
          />
          <p v-if="errors.script" class="text-sm text-destructive">{{ errors.script }}</p>
        </div>

        <!-- Variables info -->
        <div class="rounded-lg border bg-muted/50 p-3">
          <p class="mb-2 text-sm font-medium">Available Variables</p>
          <div class="flex flex-wrap gap-2">
            <code
              v-for="v in variablesInfo"
              :key="v.var"
              class="rounded bg-background px-2 py-1 text-xs"
              :title="v.desc"
            >
              {{ v.var }}
            </code>
          </div>
        </div>

        <!-- Team sharing toggle -->
        <div class="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p class="text-sm font-medium">Share with team</p>
            <p class="text-xs text-muted-foreground">Make this script available to all team members</p>
          </div>
          <Switch v-model:checked="shareWithTeam" />
        </div>

        <DialogFooter class="mt-4">
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ script ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
