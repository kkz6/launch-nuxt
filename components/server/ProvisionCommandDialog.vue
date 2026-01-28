<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'

interface Props {
  serverId: string
  provisionCommand: string | null
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })

const provisionScript = ref('')
const provisionScriptLoading = ref(false)
const provisionScriptError = ref('')
const showScriptContent = ref(false)
const commandCopied = ref(false)
const scriptCopied = ref(false)

// Copy text to clipboard
const copyToClipboard = async (text: string, type: 'command' | 'script') => {
  try {
    await navigator.clipboard.writeText(text)
    if (type === 'command') {
      commandCopied.value = true
      setTimeout(() => { commandCopied.value = false }, 2000)
    } else {
      scriptCopied.value = true
      setTimeout(() => { scriptCopied.value = false }, 2000)
    }
    toast.success('Copied to clipboard')
  } catch {
    toast.error('Failed to copy to clipboard')
  }
}

// Fetch the provision script content
const fetchProvisionScript = async () => {
  // Don't refetch if already have script (unless there's an error)
  if (provisionScript.value && !provisionScriptError.value) return

  provisionScriptLoading.value = true
  provisionScriptError.value = ''
  provisionScript.value = ''
  try {
    const response = await $api<{ success: boolean; data: { script: string } }>(`/servers/${props.serverId}/provision-script-content`)
    provisionScript.value = response.data?.script || ''
    if (!provisionScript.value) {
      provisionScriptError.value = 'Script content is empty'
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    provisionScriptError.value = err.data?.message || 'Failed to fetch provision script'
    toast.error(provisionScriptError.value)
  } finally {
    provisionScriptLoading.value = false
  }
}

// Reset state and fetch script when dialog opens
watch(open, (isOpen) => {
  if (isOpen) {
    // Reset error state on open
    provisionScriptError.value = ''
    if (!provisionScript.value) {
      fetchProvisionScript()
    }
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="lucide:terminal" class="h-5 w-5" />
          Provision Command
        </DialogTitle>
        <DialogDescription>
          Run this command as root on your server to authorize Launch to manage it.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 overflow-x-hidden">
        <!-- Quick Command -->
        <div v-if="provisionCommand" class="space-y-2">
          <Label>Quick Command</Label>
          <div class="flex items-center gap-2">
            <div class="flex-1 overflow-hidden rounded-md border bg-muted/50 p-3">
              <code class="break-all text-sm">{{ provisionCommand }}</code>
            </div>
            <Button
              variant="outline"
              size="icon"
              @click="copyToClipboard(provisionCommand, 'command')"
            >
              <Icon
                :name="commandCopied ? 'lucide:check' : 'lucide:copy'"
                class="h-4 w-4"
              />
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            This command downloads and runs the provisioning script from the server.
          </p>
        </div>

        <!-- Collapsible Script Content -->
        <Collapsible v-model:open="showScriptContent" class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Script Content (for local development)</Label>
            <CollapsibleTrigger as-child>
              <Button variant="ghost" size="sm">
                <Icon
                  :name="showScriptContent ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                  class="mr-1 h-4 w-4"
                />
                {{ showScriptContent ? 'Hide' : 'Show' }} Script
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div class="space-y-2">
              <div v-if="provisionScriptLoading" class="flex items-center justify-center p-4">
                <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin" />
              </div>
              <div v-else-if="provisionScriptError" class="rounded-md border border-destructive/50 bg-destructive/10 p-4">
                <p class="text-sm text-destructive">{{ provisionScriptError }}</p>
                <Button
                  variant="outline"
                  size="sm"
                  class="mt-2"
                  @click="fetchProvisionScript"
                >
                  Retry
                </Button>
              </div>
              <div v-else-if="provisionScript" class="relative">
                <div class="max-h-80 overflow-auto rounded-md border bg-muted/50">
                  <pre class="p-4 text-xs whitespace-pre-wrap break-all"><code>{{ provisionScript }}</code></pre>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="absolute right-2 top-2"
                  @click="copyToClipboard(provisionScript, 'script')"
                >
                  <Icon
                    :name="scriptCopied ? 'lucide:check' : 'lucide:copy'"
                    class="mr-1 h-3 w-3"
                  />
                  {{ scriptCopied ? 'Copied' : 'Copy' }}
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">
                Use this if the server cannot reach the application URL (e.g., local development).
                Copy and paste this script directly into your server's terminal.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Status indicator -->
        <div class="flex items-start gap-3 rounded-lg bg-amber-50 p-4 dark:bg-amber-950/50">
          <Icon name="lucide:alert-triangle" class="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div class="space-y-1">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
              Server pending provisioning
            </p>
            <p class="text-sm text-amber-700 dark:text-amber-300">
              Run the provision command on your server to allow Launch to connect and manage it.
            </p>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
