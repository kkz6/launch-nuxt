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
  siteAddress?: string
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
  { value: '301', label: 'Permanent (301)', description: 'Recommended for SEO' },
  { value: '302', label: 'Temporary (302)', description: 'Temporary redirect' },
  { value: '307', label: 'Temporary (307)', description: 'Preserves method' },
  { value: '308', label: 'Permanent (308)', description: 'Preserves method' },
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

// Detect if it's a pattern redirect
const isPatternRedirect = computed(() => {
  return from.value.includes('*')
})

// Generate preview examples
const previewExamples = computed(() => {
  const baseUrl = props.siteAddress ? `https://${props.siteAddress}` : 'https://yoursite.com'
  const fromPath = from.value.trim() || '/old-path'
  const toPath = to.value.trim() || '/new-path'

  if (isPatternRedirect.value) {
    // Pattern redirect preview
    const examplePath = fromPath.replace('*', 'example-page')
    const exampleTo = toPath.includes('{path}')
      ? toPath.replace('{path}', 'example-page')
      : toPath

    return [
      { from: `${baseUrl}${examplePath}`, to: exampleTo.startsWith('http') ? exampleTo : `${baseUrl}${exampleTo}` },
    ]
  }

  // Exact redirect preview
  return [
    { from: `${baseUrl}${fromPath}`, to: toPath.startsWith('http') ? toPath : `${baseUrl}${toPath}` },
  ]
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
          Configure URL redirects for your site.
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="from">From Path</Label>
          <Input
            id="from"
            v-model="from"
            placeholder="/old-page or /blog/*"
          />
          <p v-if="errors.from" class="text-sm text-destructive">{{ errors.from }}</p>
          <p v-else class="text-sm text-muted-foreground">
            Use <code class="rounded bg-muted px-1">*</code> for pattern matching (e.g., <code class="rounded bg-muted px-1">/blog/*</code>)
          </p>
        </div>

        <div class="space-y-2">
          <Label for="to">To Path or URL</Label>
          <Input
            id="to"
            v-model="to"
            placeholder="/new-page or /news/{path}"
          />
          <p v-if="errors.to" class="text-sm text-destructive">{{ errors.to }}</p>
          <p v-else class="text-sm text-muted-foreground">
            <template v-if="isPatternRedirect">
              Use <code class="rounded bg-muted px-1">{path}</code> to include the matched wildcard
            </template>
            <template v-else>
              Enter a path or full URL
            </template>
          </p>
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
                <span>{{ rt.label }}</span>
                <span class="ml-2 text-muted-foreground">- {{ rt.description }}</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.type" class="text-sm text-destructive">{{ errors.type }}</p>
        </div>

        <!-- Live Preview -->
        <div v-if="from.trim() && to.trim()" class="rounded-lg border bg-muted/50 p-4">
          <div class="mb-3 flex items-center gap-2">
            <Icon name="lucide:eye" class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">Preview</span>
            <Badge v-if="isPatternRedirect" variant="secondary" class="text-xs">Pattern</Badge>
            <Badge v-else variant="outline" class="text-xs">Exact</Badge>
          </div>
          <div v-for="(example, index) in previewExamples" :key="index" class="space-y-2">
            <div class="flex items-baseline gap-2">
              <span class="w-8 shrink-0 text-xs font-medium text-muted-foreground">From</span>
              <code class="min-w-0 break-all rounded bg-background px-2 py-1 text-xs">{{ example.from }}</code>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="w-8 shrink-0 text-xs font-medium text-muted-foreground">To</span>
              <code class="min-w-0 break-all rounded bg-background px-2 py-1 text-xs">{{ example.to }}</code>
            </div>
          </div>
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
