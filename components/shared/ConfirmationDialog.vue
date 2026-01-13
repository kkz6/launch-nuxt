<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Checkbox } from '~/components/ui/checkbox'

interface ConfirmationOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  inputVerificationText?: string
  helpText?: string
  hasInput?: boolean
  checkbox?: {
    label: string
    checked: boolean
  }
}

interface ConfirmationResult {
  ok: boolean
  value?: string
  checkbox?: { checked: boolean }
}

const isOpen = ref(false)
const options = ref<ConfirmationOptions>({
  title: '',
  description: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  destructive: false,
})
const verifiedText = ref('')
const checkboxState = ref<{ label: string; checked: boolean } | undefined>()

let resolvePromise: ((value: ConfirmationResult) => void) | null = null

const show = (opts: ConfirmationOptions): Promise<ConfirmationResult> => {
  options.value = {
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    destructive: false,
    ...opts,
  }
  verifiedText.value = ''
  checkboxState.value = opts.checkbox ? { ...opts.checkbox } : undefined
  isOpen.value = true
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

const isConfirmDisabled = computed(() => {
  if (options.value.inputVerificationText) {
    return options.value.inputVerificationText !== verifiedText.value
  }
  return false
})

const handleConfirm = () => {
  isOpen.value = false
  resolvePromise?.({
    ok: true,
    value: verifiedText.value || undefined,
    checkbox: checkboxState.value,
  })
}

const handleCancel = () => {
  isOpen.value = false
  resolvePromise?.({ ok: false })
}

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !isConfirmDisabled.value) {
    handleConfirm()
  }
}

defineExpose({ show })
</script>

<template>
  <AlertDialog v-model:open="isOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ options.title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ options.description }}</AlertDialogDescription>

        <section v-if="options.inputVerificationText || options.hasInput || options.checkbox" class="text-sm text-muted-foreground">
          <div class="grid w-full items-center gap-2.5 py-2">
            <Label v-if="options.helpText" for="verification">{{ options.helpText }}</Label>

            <Input
              v-if="options.inputVerificationText"
              id="verification-display"
              class="w-full"
              disabled
              :value="options.inputVerificationText"
            />

            <Input
              v-if="options.inputVerificationText || options.hasInput"
              id="verification"
              v-model="verifiedText"
              :placeholder="options.inputVerificationText || ''"
              class="w-full"
              @keyup="handleKeyUp"
            />

            <div v-if="checkboxState" class="flex items-center space-x-2">
              <Checkbox
                id="checkbox"
                :checked="checkboxState.checked"
                @update:checked="checkboxState!.checked = $event as boolean"
              />
              <Label for="checkbox">{{ checkboxState.label }}</Label>
            </div>
          </div>
        </section>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel">
          {{ options.cancelText }}
        </AlertDialogCancel>
        <AlertDialogAction
          :disabled="isConfirmDisabled"
          :class="{ 'bg-destructive text-destructive-foreground hover:bg-destructive/90': options.destructive }"
          @click="handleConfirm"
        >
          {{ options.confirmText }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
